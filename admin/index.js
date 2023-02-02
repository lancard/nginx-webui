const fs = require('fs');
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const { exec } = require('child_process');

const app = express();
const port = 3000;
const sessionTime = 1000 * 60 * 5;

var config;


function loadConfig() {
    try {
        config = JSON.parse(fs.readFileSync('/config/config.json'));
    }
    catch (e) {
        config = {
            adminPassword: "changeme!"
        };
    }
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

app.use(session(sessionObj));

app.use('/static', express.static('static'));

app.get('/', (req, res) => {
    res.redirect('/static/index.html');
});

app.get('/api/login', (req, res) => {
    req.session.userName = "admin";
    req.session.save();
    res.send("OK");
});

app.get('/api/test', (req, res) => {
    exec("ls -la", (error, stdout, stderr) => {
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
    console.log(`Example app listening on port ${port}`);
});