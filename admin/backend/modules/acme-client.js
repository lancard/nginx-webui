import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as writeFileAtomic from 'write-file-atomic';

function base64url(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

class ACMEClient {
    constructor() {
        this.directoryUrl = 'https://acme-v02.api.letsencrypt.org/directory';
        fetch(this.directoryUrl).then(r => r.json()).then(data => {
            this.directory = data;

            this.acmeKeyPath = '/data/cert/acme-account-key.pem';
            if (!fs.existsSync(this.acmeKeyPath)) {
                const accountKey = this.createPrivateKey();
                writeFileAtomic.sync(this.acmeKeyPath, accountKey);
            }

            this.accountKeyPem = fs.readFileSync(this.acmeKeyPath, 'utf8');
            this.createAccount();
        });
    }

    async createAccount() {
        const r = await this.signedRequest(
            this.directory.newAccount,
            {
                termsOfServiceAgreed: true
            }
        );

        this.kid =
            r.headers.get('location');
    }


    async getNonce() {
        const r = await fetch(
            this.directory.newNonce,
            { method: 'HEAD' }
        );

        return r.headers.get('replay-nonce');
    }

    exportJWK() {
        const key = crypto.createPublicKey(
            this.accountKeyPem
        );

        const jwk = key.export({
            format: 'jwk'
        });

        return {
            e: jwk.e,
            kty: jwk.kty,
            n: jwk.n
        };
    }

    jwkThumbprint() {
        const jwk = this.exportJWK();

        const hash = crypto
            .createHash('sha256')
            .update(JSON.stringify({
                e: jwk.e,
                kty: jwk.kty,
                n: jwk.n
            }))
            .digest();

        return base64url(hash);
    }

    async signedRequest(url, payload = '') {
        const nonce = await this.getNonce();

        const protectedHeader = {
            alg: 'RS256',
            nonce,
            url
        };

        if (this.kid) {
            protectedHeader.kid = this.kid;
        } else {
            protectedHeader.jwk =
                this.exportJWK();
        }

        const protected64 = base64url(
            JSON.stringify(protectedHeader)
        );

        const payload64 = payload === ''
            ? ''
            : base64url(
                JSON.stringify(payload)
            );

        const signer =
            crypto.createSign('RSA-SHA256');

        signer.update(
            `${protected64}.${payload64}`
        );

        const signature = signer.sign(
            this.accountKeyPem
        );

        return fetch(url, {
            method: 'POST',
            headers: {
                'content-type':
                    'application/jose+json'
            },
            body: JSON.stringify({
                protected: protected64,
                payload: payload64,
                signature: base64url(signature)
            })
        });
    }

    async createOrder(domains) {
        const r = await this.signedRequest(
            this.directory.newOrder,
            {
                identifiers: domains.map(v => ({
                    type: 'dns',
                    value: v
                }))
            }
        );

        return {
            ...(await r.json()),
            orderUrl:
                r.headers.get('location')
        };
    }

    async waitValid(url) {
        while (true) {
            const r =
                await this.signedRequest(url);

            const data = await r.json();

            if (data.status === 'valid') {
                return data;
            }

            if (data.status === 'invalid') {
                throw new Error(
                    JSON.stringify(data)
                );
            }

            await sleep(2000);
        }
    }

    createPrivateKey() {
        const { privateKey } =
            crypto.generateKeyPairSync(
                'rsa',
                {
                    modulusLength: 2048
                }
            );

        return privateKey.export({
            type: 'pkcs8',
            format: 'pem'
        });
    }

    createCSR(domain, privateKeyPem) {
        const tmpDir =
            fs.mkdtempSync(
                path.join(
                    os.tmpdir(),
                    'acme-'
                )
            );

        const keyPath =
            path.join(tmpDir, 'key.pem');

        const csrPath =
            path.join(tmpDir, 'csr.der');

        fs.writeFileSync(
            keyPath,
            privateKeyPem
        );

        execFileSync('openssl', [
            'req',
            '-new',
            '-sha256',
            '-key',
            keyPath,
            '-subj',
            `/CN=${domain}`,
            '-outform',
            'DER',
            '-out',
            csrPath
        ]);

        return fs.readFileSync(csrPath);
    }

    async renewCertByHTTP01({
        domain,
        email,
        challengeCreateFn,
        challengeRemoveFn
    }) {
        // await this.createAccount(email);

        const privateKeyPem =
            this.createPrivateKey();

        const csr =
            this.createCSR(
                domain,
                privateKeyPem
            );

        const order = await this.createOrder([domain]);

        for (const authUrl of order.authorizations) {
            const authRes =
                await this.signedRequest(
                    authUrl
                );

            const auth =
                await authRes.json();

            const challenge =
                auth.challenges.find(
                    v =>
                        v.type ===
                        'http-01'
                );

            const keyAuth =
                `${challenge.token}.${this.jwkThumbprint()}`;

            await challengeCreateFn({
                token: challenge.token,
                keyAuthorization:
                    keyAuth
            });

            await this.signedRequest(
                challenge.url,
                {}
            );

            await this.waitValid(
                challenge.url
            );

            await challengeRemoveFn({
                token: challenge.token
            });
        }

        await this.signedRequest(
            order.finalize,
            {
                csr: base64url(csr)
            }
        );

        const validOrder =
            await this.waitValid(
                order.orderUrl
            );

        const cert = await fetch(
            validOrder.certificate
        ).then(r => r.text());

        return {
            cert,
            privateKey: privateKeyPem
        };
    }

    async renewCertByDNS01({
        domain,
        email,
        wildcard = false,

        challengeCreateFn,
        challengeRemoveFn = async () => { }
    }) {
        // await this.createAccount(email);

        const privateKeyPem =
            this.createPrivateKey();

        const csr =
            this.createCSR(
                domain,
                privateKeyPem
            );

        const domains = [domain];

        if (wildcard) {
            domains.push(`*.${domain}`);
        }

        const order = await this.createOrder(domains);

        for (const authUrl of order.authorizations) {
            const authRes =
                await this.signedRequest(
                    authUrl
                );

            const auth =
                await authRes.json();

            const challenge =
                auth.challenges.find(
                    v =>
                        v.type ===
                        'dns-01'
                );

            const keyAuth =
                `${challenge.token}.${this.jwkThumbprint()}`;

            const dnsValue = base64url(
                crypto
                    .createHash('sha256')
                    .update(keyAuth)
                    .digest()
            );

            await challengeCreateFn({
                domain: auth.identifier.value,
                txtName:
                    `_acme-challenge.${auth.identifier.value}`,
                txtValue: dnsValue
            });

            await this.signedRequest(
                challenge.url,
                {}
            );

            await this.waitValid(
                challenge.url
            );

            await challengeRemoveFn({
                domain: auth.identifier.value,
                txtName:
                    `_acme-challenge.${auth.identifier.value}`,
                txtValue: dnsValue
            });
        }

        await this.signedRequest(
            order.finalize,
            {
                csr: base64url(csr)
            }
        );

        const validOrder =
            await this.waitValid(
                order.orderUrl
            );

        const cert = await fetch(
            validOrder.certificate
        ).then(r => r.text());

        return {
            cert,
            privateKey: privateKeyPem
        };
    }
}

const defaultHandler = new ACMEClient();

export default defaultHandler;