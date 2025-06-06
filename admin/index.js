const fs = require('fs');
const http = require('http');
const dayjs = require('dayjs');
const si = require('systeminformation');
const express = require('express');
const session = require('express-session');
const FileStore = require("session-file-store")(session);
const { exec } = require('child_process');

const port = 3000;
const sessionTime = 30 * 60;
const configFile = '/data/config.json';
const domainNameRegex = /^[0-9a-zA-Z\.]+$/;


process.once('SIGTERM', (code) => {
    process.exit(0);
});

function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(configFile));
    }
    catch (e) {
        return {
            upstream: `upstream test_service {
    server backend1.example.com weight=5;
    server backend2.example.com;
    server 192.0.0.1 backup;
}
`
        };
    }
}

function saveConfig(configText) {
    fs.writeFileSync(configFile, configText);
}

function isUnauthroizedRequest(req, res) {
    if (!req || !req.session || req.session.user != 'administrator') {
        res.sendStatus(401);
        return true;
    }

    return false;
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

        e.locations.forEach(ee => {
            nginxConfig += `  location ${ee.address} { \n ${ee.config} \n }\n`;
        });

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

app.use(express.urlencoded({ extended: false }));

app.use(session(sessionObj));

app.use('/static', express.static('static'));

app.get('/', (req, res) => {
    res.redirect('/static/login.html');
});

app.post('/api/login', (req, res) => {
    if (req.body.user != "administrator") {
        res.send("username or password invalid");
        return;
    }

    if (req.body.password != fs.readFileSync("/data/password.txt").toString()) {
        res.send("username or password invalid");
        return;
    }
    req.session.user = req.body.user;
    req.session.save();
    res.send("successfully login");
});

app.post('/api/logout', (req, res) => {
    delete req.session.user;
    req.session.save();
    res.send("OK");
});

app.get('/api/getNginxStatus', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    http.get('http://127.0.0.1:5000/status', function (apiRes) {
        apiRes.setEncoding('utf8');

        var resData = '';
        apiRes.on('data', function (chunk) {
            resData += chunk;
        });

        apiRes.on('end', function () {
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
        if(e=="README")
            return;

        ret.push({certName: e, lastModified: fs.statSync(`/etc/letsencrypt/live/${e}/privkey.pem`).mtime});
    });

    res.end(JSON.stringify(ret));
});

app.post('/api/uploadCert', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    if (!domainNameRegex.test(req.body.name)) {
        res.end("domain name invalid");
        return;
    }

    const dir = `/etc/letsencrypt/live/${req.body.name}`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    fs.writeFileSync(`${dir}/fullchain.pem`, req.body.cert);
    fs.writeFileSync(`${dir}/privkey.pem`, req.body.key);

    res.end("Upload OK");
});

app.post('/api/renewCertByDns', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    if (!domainNameRegex.test(req.body.name)) {
        res.end("domain name invalid");
        return;
    }

    console.log(`new cert (dns): ${req.body.name}`);
    exec(`/admin/shell/dns-challenge.sh ${req.body.name} ${req.body.email}`, (error, stdout, stderr) => {
        res.end(stdout);
        console.log("result", error, stdout, stderr);
    });
});

app.get('/api/getSystemInformation', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    si.networkConnections()
        .then(data => {
            res.send(JSON.stringify(data));
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

    fs.writeFileSync('/etc/logrotate.d/nginx', req.body.logrotate);

    res.send("OK");
});

app.get('/api/getConfig', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    res.send(JSON.stringify(loadConfig()));
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

app.post('/api/testConfig', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    var nginxConfig = fs.readFileSync('/nginx_config/default_nginx.conf').toString();

    nginxConfig = nginxConfig.split("#[replaced_location]").join(configToNginxConfig(loadConfig()));

    fs.writeFileSync('/nginx_config/nginx.conf', nginxConfig);

    exec("nginx -t -c /nginx_config/nginx.conf", (error, stdout, stderr) => {
        var obj = {
            error,
            stdout,
            stderr
        };
        res.send(JSON.stringify(obj));
    });
});

function applyConfig(callback) {

    var nginxConfig = fs.readFileSync('/nginx_config/default_nginx.conf').toString();

    nginxConfig = nginxConfig.split("#[replaced_location]").join(configToNginxConfig(loadConfig()));

    fs.writeFileSync('/etc/nginx/nginx.conf', nginxConfig);
    fs.writeFileSync('/data/nginx.conf', nginxConfig);

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
        res.send(JSON.stringify(obj));
    });
});

function generateCert(domain, email) {
    exec(`certbot certonly --nginx -n --agree-tos -d ${domain} -m ${email}`, (error, stdout, stderr) => {
        console.log("new cert", error, stdout, stderr);
    });
}

app.post('/api/renewCert', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    generateCert(req.body.domain, req.body.email);

    res.end("You have requested a certificate to be generated. (Working in the background)\nIf you want to apply new cert, click 'Apply nginx' button 1min later.");
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
            res.send(JSON.stringify(obj));
        });
    } catch (e) {
        res.end("No such upstream or backend address / error occured: " + e);

    }
});

app.listen(port, () => {
    console.log(`listening on port ${port}`);
});

function renewalCert() {
    console.log("renewal start");

    var config = loadConfig();

    try {
        var renewExist = false;

        config.site.forEach(site => {
            if (!site.adminEmail || site.adminEmail == "" || !site.serverName || site.serverName == "" || site.autoRenew != "true")
                return;

            console.log(` - checking: ${site.serverName}`);
            const filename = `/etc/letsencrypt/live/${site.serverName}/fullchain.pem`;
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
            generateCert(site.serverName, site.adminEmail);
        });

        // reload nginx
        if (renewExist) {
            setTimeout(function () {
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
