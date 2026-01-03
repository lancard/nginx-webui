import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import validator from 'validator';
import { execFile, exec } from 'child_process';
import * as acme from 'acme-client';
import * as writeFileAtomic from 'write-file-atomic';

class CertHandler {
    constructor(options = {}) {
        this.challengeDir = options.challengeDir || '/usr/share/nginx/html/.well-known/acme-challenge';
        this.acmeKeyPath = options.acmeKeyPath || '/data/cert/acme-account-key.pem';
        this.certRoot = options.certRoot || '/data/cert';
        this._getAcmePrivateKey().then(key => {
            this.accountKey = key;
            this.client = new acme.Client({
                directoryUrl: acme.directory.letsencrypt.staging,
                accountKey: this.accountKey
            });
            logger.info('ACME client initialized');
        });

        if (!fs.existsSync(this.challengeDir)) fs.mkdirSync(this.challengeDir, { recursive: true });
    }

    async _getAcmePrivateKey() {
        if (fs.existsSync(this.acmeKeyPath)) {
            return fs.readFileSync(this.acmeKeyPath, 'utf8');
        }

        const accountKey = await acme.crypto.createPrivateKey();
        writeFileAtomic.sync(this.acmeKeyPath, accountKey);
        return accountKey;
    }

    _checkPathUnderRoot(rootPath, targetPath) {
        const resolvedRoot = path.resolve(rootPath);
        const resolvedTarget = path.resolve(targetPath);
        const relative = path.relative(resolvedRoot, resolvedTarget);
        return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    }

    getFullChainPath(domain) {
        const certPath = path.join(this.certRoot, domain, 'fullchain.pem');
        if (this._checkPathUnderRoot(this.certRoot, certPath) && fs.existsSync(certPath)) {
            return certPath;
        }
        return null;
    }

    getCertList() {
        const arr = fs.readdirSync(this.certRoot);
        const ret = [];
        arr.forEach(e => {
            // check e is directory
            const stat = fs.statSync(path.join(this.certRoot, e));
            if (!stat.isDirectory()) return;

            const dirPath = path.join(this.certRoot, e);
            const keyPath = path.join(this.certRoot, e, 'privkey.pem');
            ret.push({
                domain: e,
                created: fs.statSync(dirPath).mtime,
                modified: fs.existsSync(keyPath) ? fs.statSync(keyPath).mtime : null
            });
        });
        return ret;
    }

    uploadCert(domain, cert, key) {
        const dir = path.join(this.certRoot, domain);
        if (!this._checkPathUnderRoot(this.certRoot, dir)) {
            throw new Error('security');
        }

        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        writeFileAtomic.sync(path.join(dir, 'fullchain.pem'), cert);
        writeFileAtomic.sync(path.join(dir, 'privkey.pem'), key);
    }

    deleteCert(domain) {
        if (!validator.isFQDN(domain, { require_tld: false })) {
            throw new Error('invalid domain');
        }

        const dir = path.join(this.certRoot, domain);
        if (this._checkPathUnderRoot(this.certRoot, dir) && fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }

    async renewCertHTTP(domain, email) {
        if (!validator.isFQDN(domain, { require_tld: false }) || !validator.isEmail(email)) {
            new Error('Invalid domain or email');
        }

        // Ensure account is created
        await this.client.createAccount({
            termsOfServiceAgreed: true,
            contact: [`mailto:${email}`]
        });

        // create private key
        const privateKey = await acme.crypto.createPrivateKey();
        // create csr
        const [key, csr] = await acme.crypto.createCsr({ commonName: domain }, privateKey);
        // get certificate
        const cert = await this.client.auto({
            csr,
            email,
            termsOfServiceAgreed: true,
            challengePriority: ['http-01'],
            challengeCreateFn: async (authz, challenge, keyAuthorization) => {
                const challengePath = path.join(this.challengeDir, challenge.token);
                await writeFileAtomic.sync(challengePath, keyAuthorization);
            },
            challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
                const challengePath = path.join(this.challengeDir, challenge.token);
                if (fs.existsSync(challengePath)) {
                    fs.unlinkSync(challengePath);
                }
            }
        });

        // store certificate
        this.uploadCert(domain, cert, privateKey);
        logger.info(`Certificate for ${domain} renewed successfully`);
    }

    async renewCertDNS(domain, email, wildcard) {
        if (!validator.isFQDN(domain, { require_tld: false }) || !validator.isEmail(email)) {
            new Error('Invalid domain or email');
        }

        // Ensure account is created
        await this.client.createAccount({
            termsOfServiceAgreed: true,
            contact: [`mailto:${email}`]
        });

        // create private key
        const privateKey = await acme.crypto.createPrivateKey();
        // create csr
        const [key, csr] = await acme.crypto.createCsr({ commonName: domain, altNames: (wildcard ? [`*.${domain}`] : []) }, privateKey);
        // get certificate
        const cert = await this.client.auto({
            csr,
            email,
            termsOfServiceAgreed: true,
            challengePriority: ['dns-01'],
            challengeCreateFn: async (authz, challenge, keyAuthorization) => {
                const recordValue = acme.crypto.createHash('sha256', keyAuthorization).toString('base64url');
                console.log(recordValue);
            },
            challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
                // No action needed for DNS cleanup in this example
            }
        });

        // store certificate
        this.uploadCert(domain, cert, privateKey);
        logger.info(`Certificate for ${domain} renewed successfully`);
    }
}

const defaultHandler = new CertHandler();
export default defaultHandler;