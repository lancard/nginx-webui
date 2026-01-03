import dayjs from 'dayjs';
import si from 'systeminformation';
import validator from 'validator';
import isPortReachable from 'is-port-reachable';

// web related imports
import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

// fetch nginx-webui modules
import logger from './modules/logger.js';
import certHandler from './modules/cert-handler.js';
import cryptoHandler from './modules/crypto-handler.js';
import loginHandler from './modules/login-handler.js';
import nginxHandler from './modules/nginx-handler.js';
import logrotateHandler from './modules/logrotate-handler.js';

process.once('SIGTERM', (code) => {
    process.exit(0);
});

class Server {
    constructor() {
        const isProd = process.env.NODE_ENV === 'production';

        this.devMode = !isProd;
        this.port = this.devMode ? 8080 : 3000;

        this.jwtSecret = process.env.JWT_SECRET;
        if (!this.jwtSecret) {
            this.jwtSecret = cryptoHandler.generateRandomHex(64);
            if (this.devMode) {
                this.jwtSecret = "test1234567890ab";
            }
            logger.info("no JWT_SECRET environment variable found.");
            logger.info("Generated JWT_SECRET = " + this.jwtSecret);
        }

        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';
        this.cookieTokenName = this.devMode ? 'nginxwebuitoken_dev' : 'nginxwebuitoken';
        this.limiter = rateLimit({
            windowMs: 1000,
            max: 20
        });

        this.app = express();
        this.setupRoutes();
    }


    renewalCert() {
        const config = nginxHandler.loadConfig();
        const twoMonthBefore = dayjs().add(-2, 'month');

        try {
            let renewExist = false;
            config.cert.forEach(cert => {
                const filename = certHandler.getFullChainPath(cert.domain);

                let lastTime = dayjs('1900-01-01', 'YYYY-MM-DD');

                try {
                    const statObject = fs.statSync(filename);
                    if (statObject && statObject.mtime) lastTime = dayjs(statObject.mtime);
                } catch (e) {
                    // not exist
                }

                if (lastTime.isAfter(twoMonthBefore))
                    return;

                renewExist = true;
                certHandler.renewCertHTTP(cert.domain, cert.adminEmail);
            });

            if (renewExist) {
                setTimeout(() => {
                    nginxHandler.reloadNginx((error, stdout, stderr) => {
                        logger.info("Reloaded nginx after cert renewal");
                        /*
                        logger.info(error);
                        logger.info(stdout)
                        logger.info(stderr);
                        */
                    });
                }, 60 * 1000);
            }
        } catch (e) {
            logger.error(e);
        }
    }

    setupRoutes() {
        const app = this.app;
        const devMode = this.devMode;
        const jwtSecret = this.jwtSecret;
        const jwtExpiresIn = this.jwtExpiresIn;
        const cookieTokenName = this.cookieTokenName;
        const limiter = this.limiter;

        app.set('trust proxy', process.env.TRUST_PROXY ? +(process.env.TRUST_PROXY) : 1);

        app.use(cookieParser());
        app.use('/api', limiter);
        app.use(express.urlencoded({ extended: false }));
        app.use('/static', express.static('../frontend'));

        app.use((req, res, next) => {
            if (req.path.startsWith('/static') || req.path.startsWith('/api/upstream/') || req.path === '/' || req.path === '/favicon.ico' || req.path === '/api/login' || req.path === '/api/checkLogin' || req.path === '/api/logout') {
                return next();
            }

            const token = req.cookies[cookieTokenName];

            if (!req || !token) {
                res.sendStatus(401);
                return;
            }

            try {
                const jwtInfo = jwt.verify(token, jwtSecret);
                req.loginInfo = jwtInfo;
            }
            catch (e) {
                res.sendStatus(401);
                return;
            }

            next();
        });

        app.get('/', (req, res) => res.redirect('/static/login.html'));

        app.post('/api/login', (req, res) => {
            const errorMessage = loginHandler.tryCheckPassword(req.body.user, req.body.password);

            if (errorMessage != "") {
                res.json({ success: false, errorMessage });
                return;
            }

            const token = jwt.sign({ user: req.body.user }, jwtSecret, { expiresIn: jwtExpiresIn });

            res.cookie(cookieTokenName, token, {
                httpOnly: true,
                secure: !devMode,
                sameSite: 'Strict'
            });

            res.json({ success: true });
        });

        app.post('/api/checkLogin', (req, res) => {
            if (!req.loginInfo || !req.loginInfo.user != 'administrator') {
                res.json({ success: false });
                return;
            }

            res.json({ success: true });
            return;
        });

        app.post('/api/logout', (req, res) => {
            res.clearCookie(cookieTokenName);
            res.json({ success: true });
        });

        app.post('/api/changePassword', (req, res) => {
            loginHandler.changePassword(req.body.user, req.body.password);
            res.json({ success: true });
        });

        app.get('/api/getNginxStatus', (req, res) => {
            fetch('http://127.0.0.1:5000/status')
                .then(apiRes => apiRes.text())
                .then(resData => {
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.status(200).send(resData);
                });
        });

        app.get('/api/getAnubisStatus', (req, res) => {
            fetch('http://127.0.0.1:9090/metrics')
                .then(apiRes => apiRes.text())
                .then(resData => {
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.status(200).send(resData);
                });
        });

        app.get('/api/getCertList', (req, res) => {
            res.json(certHandler.getCertList());
        });

        app.post('/api/uploadCert', (req, res) => {
            certHandler.uploadCert(req.body.domain, req.body.cert, req.body.key);
            res.json({ success: true });
        });

        app.post('/api/deleteCert', (req, res) => {
            certHandler.deleteCert(req.body.domain);
            res.json({ success: true });
        });

        app.post('/api/renewCertHTTP', (req, res) => {
            const domain = req.body.domain;
            const email = req.body.email;
            certHandler.renewCertHTTP(domain, email)
                .then(() => {
                    res.end("success");
                });
        });

        app.post('/api/renewCertDNS', (req, res) => {
            const domain = req.body.domain;
            const email = req.body.email;
            const wildcard = req.body.wildcard == 'true' ? true : false;
            certHandler.renewCertDNS(domain, email, wildcard, (cert) => { res.json(cert); })
                .then(() => {
                    // check response closed
                    if (!res.writableEnded) {
                        res.json({ success: true });
                    }
                });
        });

        app.get('/api/getSystemInformation', (req, res) => {
            si.networkConnections()
                .then(data => res.json(data));
        });

        app.get('/api/getNginxAccessLog', (req, res) => {
            nginxHandler.getNginxAccessLog(1000).then((lines) => res.send(lines)).catch(err => res.status(500).send('ERROR'));
        });

        app.get('/api/getNginxErrorLog', (req, res) => {
            nginxHandler.getNginxErrorLog(1000).then((lines) => res.send(lines)).catch(err => res.status(500).send('ERROR'));
        });

        app.get('/api/getLogrotate', (req, res) => {
            const content = logrotateHandler.getLogrotate();
            res.send(content);
        });

        app.post('/api/saveLogrotate', (req, res) => {
            logrotateHandler.saveLogrotate(req.body.logrotate);
            res.json({ success: true });
        });

        app.get('/api/getConfig', (req, res) => res.json(nginxHandler.loadConfig()));

        app.post('/api/saveConfig', (req, res) => {
            if (!req.body.config) { res.sendStatus(500); return; }
            nginxHandler.saveConfig(req.body.config);
            res.json({ success: true });
        });

        app.post('/api/previewConfig', (req, res) => {
            const preview = nginxHandler.generateNginxConfigFromRequest(JSON.parse(req.body.config));
            const current = nginxHandler.getCurrentConfig();
            const backup = nginxHandler.getBackupConfig();

            res.json({ preview, current, backup });
        });

        app.post('/api/testConfig', (req, res) => {
            nginxHandler.testConfig(req.body && req.body.config, (obj) => {
                res.json(obj);
            });
        });

        app.post('/api/applyConfig', (req, res) => {
            nginxHandler.applyConfig(obj => res.json(obj));
        });

        app.post('/api/checkServerStatus', (req, res) => {
            const host = req.body.host;
            const port = req.body.port;

            if (!validator.isFQDN(host, { require_tld: false }) || !validator.isNumeric(port)) {
                res.json({ success: false, message: "Invalid host or port" });
                return;
            }

            isPortReachable(port, { host: host })
                .then(reachable => {
                    if (reachable) res.json({ success: true, message: "connected" });
                    else res.json({ success: false, message: "failed" });
                })
                .catch(err => res.json({ success: false, message: err.message }));
        });

        app.get('/api/upstream/:upstream_name/:backend_address/:enable_type', (req, res) => {
            try {
                const config = nginxHandler.loadConfig();
                let upstream = null;
                let backend = null;

                for (let a = 0; a < config.upstream.length; a++) {
                    if (config.upstream[a].upstreamName == req.params.upstream_name) {
                        upstream = config.upstream[a];
                        break;
                    }
                }

                if (!upstream.upstreamAuthKey || upstream.upstreamAuthKey != req.header("Authorization").split(" ")[1]) {
                    throw new Error('auth fail');
                }

                for (let a = 0; a < upstream.nodes.length; a++) {
                    if (upstream.nodes[a].address == req.params.backend_address) {
                        backend = upstream.nodes[a];
                        break;
                    }
                }

                if (req.params.enable_type == "disable") {
                    backend.disable = true;
                    nginxHandler.saveConfig(JSON.stringify(config, null, '\t'));
                }
                if (req.params.enable_type == "enable") {
                    backend.disable = false;
                    nginxHandler.saveConfig(JSON.stringify(config, null, '\t'));
                }

                nginxHandler.applyConfig(obj => res.json(obj));
            } catch (e) {
                throw new Error("No such upstream or backend address / error occured: " + e);
            }
        });
    }

    registerInterval(interval, task, runAtStart = true) {
        if (runAtStart)
            task();
        setInterval(() => {
            try {
                task();
            } catch (e) {
                logger.error("Error occured in scheduled task: ", e);
            }
        }, interval);
    }

    start() {
        this.app.listen(this.port, () => logger.info(`listening on port ${this.port}`));
        this.registerInterval(7 * 60 * 60 * 1000, () => { this.renewalCert(); }, false); // check cert renewal every 7 hours
        this.registerInterval(24 * 60 * 60 * 1000, () => { logrotateHandler.rotateLog() }); // run daily
    }
}

// instantiate and start server
new Server().start();