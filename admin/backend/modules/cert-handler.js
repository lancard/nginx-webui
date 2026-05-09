import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import validator from 'validator';
import { X509Certificate } from 'node:crypto';
import { execFile, exec } from 'child_process';
import ACMEClient from './acme-client.js';
import * as writeFileAtomic from 'write-file-atomic';

class CertHandler {
    constructor(options = {}) {
        this.challengeDir = options.challengeDir || '/usr/share/nginx/html/.well-known/acme-challenge';
        this.acmeKeyPath = options.acmeKeyPath || '/data/cert/acme-account-key.pem';
        this.certRoot = options.certRoot || '/data/cert';
        this._getAcmePrivateKey().then(key => {
            this.accountKey = key;
            this.client = new ACMEClient({
                directoryUrl:
                    'https://acme-v02.api.letsencrypt.org/directory',
                accountKeyPem: this.accountKey
            });

            await this.client.init();
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

    isWildcardCertFile(filepath) {
        if (!fs.existsSync(filepath)) {
            return false;
        }
        const certData = fs.readFileSync(filepath, 'utf8');
        const x509 = new X509Certificate(certData);
        const altNames = "" + x509.subjectAltName;
        return altNames.indexOf('*.') >= 0;
    }

    getCertList() {
        const arr = fs.readdirSync(this.certRoot);
        const ret = [];
        arr.forEach(e => {
            // check e is directory
            const stat = fs.statSync(path.join(this.certRoot, e));
            if (!stat.isDirectory()) return;

            const dirPath = path.join(this.certRoot, e);
            const keyPath = path.join(this.certRoot, e, 'fullchain.pem');
            ret.push({
                domain: e,
                created: fs.statSync(dirPath).mtime,
                modified: fs.existsSync(keyPath) ? fs.statSync(keyPath).mtime : null,
                wildcard: this.isWildcardCertFile(keyPath)
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

    async renewCertHTTP(domain, email, callback = null) {
        if (!validator.isFQDN(domain, { require_tld: false }) || !validator.isEmail(email)) {
            new Error('Invalid domain or email');
        }

        const { cert, privateKey } =
            await this.client.renewCertByHTTP01({
                domain,
                email,

                challengeCreateFn: async ({
                    token,
                    keyAuthorization
                }) => {
                    const challengePath =
                        path.join(
                            this.challengeDir,
                            token
                        );

                    writeFileAtomic.sync(
                        challengePath,
                        keyAuthorization
                    );
                },

                challengeRemoveFn: async ({
                    token
                }) => {
                    const challengePath =
                        path.join(
                            this.challengeDir,
                            token
                        );

                    if (
                        fs.existsSync(
                            challengePath
                        )
                    ) {
                        fs.unlinkSync(
                            challengePath
                        );
                    }
                }
            });

        this.uploadCert(
            domain,
            cert,
            privateKey
        );
        logger.info(`Certificate for ${domain} renewed successfully`);
    }

    async renewCertDNS(domain, email, wildcard, callback = null) {
        if (!validator.isFQDN(domain, { require_tld: false }) || !validator.isEmail(email)) {
            throw new Error('Invalid domain or email');
        }

        const {
            cert,
            privateKey
        } =
            await this.client
                .renewCertByDNS01({
                    domain,
                    email,
                    wildcard,

                    challengeCreateFn:
                        async ({
                            txtName,
                            txtValue
                        }) => {
                            if (callback) {
                                callback({
                                    txtName,
                                    txtValue
                                });
                            }
                        }
                });

        this.uploadCert(
            domain,
            cert,
            privateKey
        );
        logger.info(`Certificate for ${domain} renewed successfully`);
    }
}

const defaultHandler = new CertHandler();

export default defaultHandler;
