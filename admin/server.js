import fs from 'fs';
import path from 'path';
import writeFileAtomicSync from 'write-file-atomic';
import isPortReachable from 'is-port-reachable';
import net from 'net';
import http from 'http';
import dayjs from 'dayjs';
import si from 'systeminformation';
import express from 'express';
import session from 'express-session';
import validator from 'validator';
import NginxBeautify from 'nginxbeautify';
import sessionFileStoreInit from 'session-file-store';
import { rateLimit } from 'express-rate-limit';
import { exec, execFile } from 'child_process';
import { tryCheckPassword, changePassword } from './login.js';

const limiter = rateLimit({
    windowMs: 1000,
    max: 20
});
const FileStore = sessionFileStoreInit(session);
const nginxBeautifier = new NginxBeautify();
const port = process.env.npm_lifecycle_event == 'start' ? 3000 : 7777;
const sessionTime = 30 * 60;
const configFile = '/data/config.json';

process.once('SIGTERM', (code) => {
    process.exit(0);
});

function sendJson(res, obj, status = 200) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj, null, '\t'));
}

function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(configFile));
    }
    catch (e) {
        return {};
    }
}

function saveConfig(configText) {
    writeFileAtomicSync(configFile, configText);
}

function isUnauthroizedRequest(req, res) {
    if (!req || !req.session || req.session.user != 'administrator') {
        res.sendStatus(401);
        return true;
    }

    return false;
}

function hasListen80(configText) {
    const regex = /^\s*listen\s+80(?:\s|;|$)/m;
    return regex.test(configText);
}

function checkPathUnderRoot(rootPath, targetPath) {
    try {
        const resolvedRoot = fs.realpathSync(path.resolve(rootPath));
        const resolvedTarget = fs.realpathSync(path.resolve(targetPath));

        return resolvedTarget.startsWith(resolvedRoot + '/');
    } catch (err) {
        console.log(err);
        return false;
    }
}

function configToNginxConfig(config) {
    // common
    var nginxConfig = config.common + "\n";

    nginxConfig += `\n\n\n`;

    // upstream
    config.upstream.forEach(e => {
        nginxConfig += `upstream ${e.upstreamName} {\n`;

        e.nodes.forEach(ee => {
            nginxConfig += `  server ${ee.address} ${ee.backup ? "backup" : ""} ${ee.disable ? "down" : ""} weight=${ee.weight} max_fails=${ee.maxFails} fail_timeout=${ee.failTimeout};\n`;
        });

        nginxConfig += `\n}\n`;
    });

    nginxConfig += `\n\n\n`;

    // sites
    config.site.forEach(e => {
        nginxConfig += `# ${e.siteName}
            server { 
                ${e.siteConfig}

                ${e.serverName && e.serverName != "" ? "server_name " + e.serverName + ";" : ""}
            `;

        let isFoundAcmeChallenge = false;

        e.locations.forEach(ee => {
            if (ee.address == "/.well-known/acme-challenge" || ee.address == "/.well-known/acme-challenge/")
                isFoundAcmeChallenge = true;

            nginxConfig += `  location ${ee.address} { \n ${ee.config} \n }\n`;
        });

        if (!isFoundAcmeChallenge && hasListen80(e.siteConfig)) {
            nginxConfig += `  location /.well-known/acme-challenge { \n root /usr/share/nginx/html; \n }\n`;
        }

        nginxConfig += `\n}\n`;
    });

    return nginxConfig;
}

const sessionObj = {
    secret: 'nginxwebuisession',
    resave: true,
    saveUninitialized: false,
    store: new FileStore({ ttl: sessionTime, path: '/session', retries: 0 }),
    cookie: { maxAge: sessionTime * 1000 }
};


loadConfig();

const app = express();

app.use('/api', limiter);

app.use(express.urlencoded({ extended: false }));

app.use(session(sessionObj));

app.use('/static', express.static('static'));

app.get('/', (req, res) => {
    res.redirect('/static/login.html');
});



app.post('/api/login', (req, res) => {
    const errorMessage = tryCheckPassword(req.body.user, req.body.password);

    if (errorMessage != "") {
        res.send(errorMessage);
        return;
    }

    req.session.user = req.body.user;
    req.session.save();

    res.send("OK");
});

app.post('/api/checkLogin', (req, res) => {
    res.send(req.session.user == 'administrator');
    return;
});

app.post('/api/logout', (req, res) => {
    delete req.session.user;
    req.session.save();
    res.send("OK");
});

app.post('/api/changePassword', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    changePassword(req.body.user, req.body.password);

    res.send("OK");
});


app.get('/api/getNginxStatus', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    http.get('http://127.0.0.1:5000/status', (apiRes) => {
        apiRes.setEncoding('utf8');

        var resData = '';
        apiRes.on('data', (chunk) => {
            resData += chunk;
        });

        apiRes.on('end', () => {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.write(resData);
            res.end();
        });
    });
});

app.get('/api/getCertList', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    var arr = fs.readdirSync('/etc/letsencrypt/live');
    var ret = [];
    arr.forEach(e => {
        if (e == "README")
            return;

        let dirPath = path.join("/etc/letsencrypt/live/", e);
        let keyPath = path.join("/etc/letsencrypt/live/", e, "/privkey.pem");

        ret.push({
            domain: e,
            created: fs.statSync(dirPath).mtime,
            modified: fs.statSync(keyPath).mtime
        });
    });

    sendJson(res, ret);
});

app.post('/api/uploadCert', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    const dir = path.join("/etc/letsencrypt/live/", req.body.domain);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    writeFileAtomicSync(path.join(dir, "/fullchain.pem"), req.body.cert);
    writeFileAtomicSync(path.join(dir, "/privkey.pem"), req.body.key);

    res.end("Upload OK");
});

app.post('/api/deleteCert', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    const domain = req.body.domain;

    if (!validator.isFQDN(domain, { require_tld: false })) {
        res.end("Invalid domain name");
        return;
    }

    try {
        const dir = path.join("/etc/letsencrypt/live/", domain);
        if (checkPathUnderRoot("/etc/letsencrypt/live/", dir)) {
            console.log("deleted");
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
    catch (e) {
    }

    try {
        const renewalFile = path.join("/etc/letsencrypt/renewal/", domain + ".conf");
        if (checkPathUnderRoot("/etc/letsencrypt/renewal/", renewalFile)) {
            console.log("deleted2");
            fs.rmSync(renewalFile);
        }
    }
    catch (e) {
    }

    try {
        const dir = path.join("/etc/letsencrypt/archive/", domain);
        if (checkPathUnderRoot("/etc/letsencrypt/archive/", dir)) {
            console.log("deleted3");
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
    catch (e) {
    }

    res.end("Delete OK");
});

app.post('/api/renewCertHTTP', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    const domain = req.body.domain;
    const email = req.body.email;

    if (!validator.isFQDN(domain, { require_tld: false }) || !validator.isEmail(email)) {
        res.end("Invalid domain or email");
        return;
    }

    console.log(`new cert (http): ${domain}`);
    execFile("/usr/bin/certbot", ["certonly", "--webroot", "-w", "/usr/share/nginx/html", "--agree-tos", "-d", domain, "-m", email], (error, stdout, stderr) => {
        res.end(stdout);
        console.log("new cert", error, stdout, stderr);
    });
});

app.post('/api/renewCertDNS', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    const domain = req.body.domain;
    const email = req.body.email;
    const wildcard = req.body.wildcard;

    if (!validator.isFQDN(domain, { require_tld: false }) || !validator.isEmail(email) || !validator.isBoolean(wildcard)) {
        res.end("Invalid domain or email");
        return;
    }

    console.log(`new cert (dns): ${domain}`);
    execFile('/admin/shell/dns-challenge.sh', [domain, email, wildcard], (error, stdout, stderr) => {
        res.end(stdout);
        console.log("new cert", error, stdout, stderr);
    });
});

app.get('/api/getSystemInformation', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    si.networkConnections()
        .then(data => {
            sendJson(res, data);
        })
        .catch(error => {
            res.send("ERROR");
            console.error(error)
        });
});

app.get('/api/getLogrotate', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    res.send(fs.readFileSync('/etc/logrotate.d/nginx').toString());
});

app.post('/api/saveLogrotate', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    writeFileAtomicSync('/etc/logrotate.d/nginx', req.body.logrotate);

    res.send("OK");
});

app.get('/api/getConfig', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    sendJson(res, loadConfig());
});

app.post('/api/saveConfig', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    if (!req.body.config) {
        res.sendStatus(500);
        return;
    }

    saveConfig(req.body.config);

    res.send("OK");
});

function generateNginxConfig() {
    var nginxConfig = fs.readFileSync('/nginx_config/default_nginx.conf').toString();

    nginxConfig = nginxConfig.split("#[replaced_location]").join(configToNginxConfig(loadConfig()));

    return nginxBeautifier.parse(nginxConfig);
}

function generateNginxConfigFromRequest(config) {
    var nginxConfig = fs.readFileSync('/nginx_config/default_nginx.conf').toString();

    nginxConfig = nginxConfig.split("#[replaced_location]").join(configToNginxConfig(config));

    return nginxBeautifier.parse(nginxConfig);
}

app.post('/api/previewConfig', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    sendJson(res, {
        preview: generateNginxConfigFromRequest(JSON.parse(req.body.config)),
        current: fs.readFileSync('/etc/nginx/nginx.conf').toString(),
        backup: fs.readFileSync('/data/nginx.conf').toString(),
    });
});

app.post('/api/testConfig', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    writeFileAtomicSync('/nginx_config/nginx.conf', generateNginxConfig());

    exec("nginx -t -c /nginx_config/nginx.conf", (error, stdout, stderr) => {
        var obj = {
            error,
            stdout,
            stderr
        };
        sendJson(res, obj);
    });
});

function applyConfig(callback) {

    var nginxConfig = generateNginxConfig();

    writeFileAtomicSync('/etc/nginx/nginx.conf', nginxConfig);
    writeFileAtomicSync('/data/nginx.conf', nginxConfig);

    exec("nginx -s reload", (error, stdout, stderr) => {
        var obj = {
            error,
            stdout,
            stderr
        };
        if (callback) {
            callback(obj);
        }
    });
}

app.post('/api/applyConfig', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    applyConfig(obj => {
        sendJson(res, obj);
    });
});

app.post('/api/checkServerStatus', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    const host = req.body.host;
    const port = req.body.port;

    if (!validator.isFQDN(host, { require_tld: false }) || !validator.isNumeric(port)) {
        res.send({ success: false, message: "Invalid host or port" });
        return;
    }

    isPortReachable(port, { host: host })
        .then(reachable => {
            if (reachable) {
                res.json({ success: true, message: "connected" });
            }
            else {
                res.json({ success: false, message: "failed" });
            }
        })
        .catch(err => {
            res.json({ success: false, message: err.message });
        });
});

app.get('/api/upstream/:upstream_name/:backend_address/:enable_type', (req, res) => {
    try {
        var config = loadConfig();

        var upstream = null;
        var backend = null;

        for (var a = 0; a < config.upstream.length; a++) {
            if (config.upstream[a].upstreamName == req.params.upstream_name) {
                upstream = config.upstream[a];
                break;
            }
        }

        if (!upstream.upstreamAuthKey || upstream.upstreamAuthKey != req.header("Authorization").split(" ")[1]) {
            throw 'auth fail';
        }

        for (var a = 0; a < upstream.nodes.length; a++) {
            if (upstream.nodes[a].address == req.params.backend_address) {
                backend = upstream.nodes[a];
                break;
            }
        }

        if (req.params.enable_type == "disable") {
            backend.disable = true;
            saveConfig(JSON.stringify(config, null, '\t'));
        }
        if (req.params.enable_type == "enable") {
            backend.disable = false;
            saveConfig(JSON.stringify(config, null, '\t'));
        }

        applyConfig(obj => {
            sendJson(res, obj);
        });
    } catch (e) {
        res.end("No such upstream or backend address / error occured: " + e);

    }
});

app.listen(port, () => {
    console.log(`listening on port ${port}`);
});

function renewCertHTTP(domain, email, callback) {
    if (!validator.isFQDN(domain, { require_tld: false }) || !validator.isEmail(email)) {
        if (callback)
            callback(new Error("Invalid domain or email"), null, null);
        return;
    }

    execFile("/usr/bin/certbot", ["certonly", "--nginx", "-n", "--agree-tos", "-d", domain, "-m", email], (error, stdout, stderr) => {
        if (callback)
            callback(error, stdout, stderr);
    });
}

function renewalCert() {
    console.log("renewal start");

    var config = loadConfig();

    try {
        var renewExist = false;

        config.cert.forEach(cert => {
            console.log(` - checking: ${cert.domain}`);
            const filename = path.join("/etc/letsencrypt/live/", cert.domain, "/fullchain.pem");
            var statObject = null;
            var lastTime = dayjs("1900-01-01", "YYYY-MM-DD");
            var twoMonthBefore = dayjs().add(-2, 'month');

            try {
                statObject = fs.statSync(filename);
                if (statObject != null && statObject.mtime != null)
                    lastTime = dayjs(statObject.mtime);
            } catch (e) {
                console.log("  - not exist or error");
            }

            // don't need to renewal
            if (lastTime.isAfter(twoMonthBefore))
                return;

            // progress renewal
            renewExist = true;
            renewCertHTTP(cert.domain, cert.adminEmail);
        });

        // reload nginx
        if (renewExist) {
            setTimeout(() => {
                console.log("apply nginx reload for cert renewal");
                exec("nginx -s reload", (error, stdout, stderr) => {
                    console.log("result", error, stdout, stderr);
                    console.log("apply nginx reload for cert end");
                });
            }, 60 * 1000);
        }
    }
    catch (e) {
        console.error(e);
    }

    console.log("renewal end");
}

function rotateLog() {
    console.log("log rotation start");

    try {
        exec("/etc/cron.daily/logrotate", (error, stdout, stderr) => {
            console.log("result", error, stdout, stderr);
        });
    }
    catch (e) {
        console.error(e);
    }

    console.log("log rotation end");
}

renewalCert();
setInterval(renewalCert, 7 * 60 * 60 * 1000); // check cert renewal every 7 hours
rotateLog();
setInterval(rotateLog, 24 * 60 * 60 * 1000); // check cert renewal every 24 hours
