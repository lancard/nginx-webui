import fs from 'fs';
import path from 'path';
import validator from 'validator';
import { execFile, exec } from 'child_process';
import * as writeFileAtomic from 'write-file-atomic';

class CertHandler {
    constructor(options = {}) {
        this.liveRoot = options.liveRoot || '/etc/letsencrypt/live';
        this.renewalRoot = options.renewalRoot || '/etc/letsencrypt/renewal';
        this.archiveRoot = options.archiveRoot || '/etc/letsencrypt/archive';
        this.defaultCertbot = options.certbotPath || '/usr/bin/certbot';
    }

    _checkPathUnderRoot(rootPath, targetPath) {
        const resolvedRoot = path.resolve(rootPath);
        const resolvedTarget = path.resolve(targetPath);
        const relative = path.relative(resolvedRoot, resolvedTarget);
        return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    }

    getFullChainPath(domain) {
        const certPath = path.join(this.liveRoot, domain, 'fullchain.pem');
        if (this._checkPathUnderRoot(this.liveRoot, certPath) && fs.existsSync(certPath)) {
            return certPath;
        }
        return null;
    }

    getCertList() {
        const arr = fs.readdirSync(this.liveRoot);
        const ret = [];
        arr.forEach(e => {
            if (e === 'README') return;
            const dirPath = path.join(this.liveRoot, e);
            const keyPath = path.join(this.liveRoot, e, 'privkey.pem');
            ret.push({
                domain: e,
                created: fs.statSync(dirPath).mtime,
                modified: fs.existsSync(keyPath) ? fs.statSync(keyPath).mtime : null
            });
        });
        return ret;
    }

    uploadCert(domain, cert, key) {
        const dir = path.join(this.liveRoot, domain);
        if (!this._checkPathUnderRoot(this.liveRoot, dir)) {
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

        const dir = path.join(this.liveRoot, domain);
        if (this._checkPathUnderRoot(this.liveRoot, dir) && fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }

        const renewalFile = path.join(this.renewalRoot, domain + '.conf');
        if (this._checkPathUnderRoot(this.renewalRoot, renewalFile) && fs.existsSync(renewalFile)) {
            fs.rmSync(renewalFile);
        }

        const archiveDir = path.join(this.archiveRoot, domain);
        if (this._checkPathUnderRoot(this.archiveRoot, archiveDir) && fs.existsSync(archiveDir)) {
            fs.rmSync(archiveDir, { recursive: true, force: true });
        }
    }

    renewCertHTTP(domain, email, callback) {
        if (!validator.isFQDN(domain, { require_tld: false }) || !validator.isEmail(email)) {
            if (callback) callback(new Error('Invalid domain or email'), null, null);
            return;
        }

        execFile(this.defaultCertbot, ['certonly', '--non-interactive', '--webroot', '-w', '/usr/share/nginx/html', '--agree-tos', '-d', domain, '-m', email], (error, stdout, stderr) => {
            if (callback) callback(error, stdout, stderr);
        });
    }

    renewCertDNS(domain, email, wildcard, callback) {
        if (!validator.isFQDN(domain, { require_tld: false }) || !validator.isEmail(email)) {
            if (callback) callback(new Error('Invalid domain or email'), null, null);
            return;
        }

        execFile('/admin/shell/dns-challenge.sh', [domain, email, wildcard], (error, stdout, stderr) => {
            if (callback) callback(error, stdout, stderr);
        });
    }
}

const defaultHandler = new CertHandler();
export default defaultHandler;
