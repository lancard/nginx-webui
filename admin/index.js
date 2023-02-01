const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);

const app = express();
const port = 3000;


const sessionObj = {
    secret: 'nginxuisession',
    resave: false,
    saveUninitialized: true,
    store: new MemoryStore({ checkPeriod: 1000 * 60 * 5 }),
    cookie: {
        maxAge: 1000 * 60 * 5
    },
};

app.use(session(sessionObj)); 
app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});