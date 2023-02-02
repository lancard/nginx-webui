const fs = require('fs');
const http = require('http');
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const { exec } = require('child_process');

const port = 3000;
const sessionTime = 1000 * 60 * 5;

var config;

function loadConfig() {
    try {
        config = JSON.parse(fs.readFileSync('/data/config.json'));
    }
    catch (e) {
        config = {
            adminPassword: "changeme!"
        };
    }
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
    resave: false,
    saveUninitialized: true,
    store: new MemoryStore({ checkPeriod: sessionTime }),
    cookie: {
        maxAge: sessionTime
    }
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

    console.log(fs.readFileSync("/data/password.txt").toString());

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

app.get('/api/status', (req, res) => {
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

app.get('/api/getConfig', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    exec("nginx -t -c /nginx_config_backup/nginx.conf", (error, stdout, stderr) => {
        var obj = {
            error,
            stdout,
            stderr
        };
        // res.send(JSON.stringify(obj));
        res.send(JSON.stringify(req.session));
    });
});

app.get('/api/testConfig', (req, res) => {
    if (isUnauthroizedRequest(req, res)) return;

    exec("nginx -t -c /nginx_config_backup/nginx.conf", (error, stdout, stderr) => {
        var obj = {
            error,
            stdout,
            stderr
        };
        // res.send(JSON.stringify(obj));
        res.send(JSON.stringify(req.session));
    });
});

app.listen(port, () => {
    console.log(`listening on port ${port}`);
});