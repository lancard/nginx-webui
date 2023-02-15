const fs = require('fs');
const http = require('http');
const si = require('systeminformation');
const express = require('express');
const session = require('express-session');
const FileStore = require("session-file-store")(session);
const { exec } = require('child_process');

const port = 3000;
const sessionTime = 30 * 60;
const configFile = '/data/config.json';
const certFileRegex = /^[0-9a-zA-Z\-_]+$/;


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


const sessionObj = {
    secret: 'nginxuisession',
    resave: true,
    saveUninitialized: false,
    store: new FileStore({ ttl: sessionTime, path: '/session' }),
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

    http.get('http://localhost:5000/status', function (apiRes) {
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

app.get('/api/getCertificationList', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    res.end(JSON.stringify(fs.readdirSync('/cert')));
});

app.post('/api/uploadCertification', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    if (!certFileRegex.test(req.body.name)) {
        res.end("Filename invalid");
        return;
    }

    fs.writeFileSync(`/cert/${req.body.name}.crt`, req.body.cert);
    fs.writeFileSync(`/cert/${req.body.name}.key`, req.body.key);

    res.end("Upload OK");
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

    nginxConfig = nginxConfig.split("#[replaced_location]").join(req.body.nginxConfig);

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

app.post('/api/applyConfig', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    var nginxConfig = fs.readFileSync('/nginx_config/default_nginx.conf').toString();

    nginxConfig = nginxConfig.split("#[replaced_location]").join(req.body.nginxConfig);

    fs.writeFileSync('/etc/nginx/nginx.conf', nginxConfig);

    exec("nginx -s reload", (error, stdout, stderr) => {
        var obj = {
            error,
            stdout,
            stderr
        };
        res.send(JSON.stringify(obj));
    });
});

app.post('/api/generateCert', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    exec(`certbot certonly --nginx -n --agree-tos -d ${req.body.domain} -m ${req.body.email}`, (error, stdout, stderr) => {
        var obj = {
            error,
            stdout,
            stderr
        };
        res.send(JSON.stringify(obj));
    });
});

app.post('/api/renewCert', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    exec(`certbot renew --dry-run --nginx -n --agree-tos -d ${req.body.domain} -m ${req.body.email}`, (error, stdout, stderr) => {
        var obj = {
            error,
            stdout,
            stderr
        };
        res.send(JSON.stringify(obj));
    });
});

app.listen(port, () => {
    console.log(`listening on port ${port}`);
});
