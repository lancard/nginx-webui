import fs from 'fs';
import dayjs from 'dayjs';
import bcrypt from 'bcrypt';

const saltRounds = 7;
const passwordFile = '/data/password.json';
const maxTryCount = 20;

export function hashPassword(plainPassword) {
    const hash = bcrypt.hashSync(plainPassword, saltRounds);
    return hash;
}

export function loadPassword() {
    try {
        return JSON.parse(fs.readFileSync(passwordFile));
    }
    catch (e) {
        return {};
    }
}

export function savePassword(configPassowrd) {
    fs.writeFileSync(passwordFile, JSON.stringify(configPassowrd, null, '\t'));
}

export function tryCheckPassword(user, password) {
    const userList = loadPassword();

    let userInfo = userList[user];

    if (!userInfo) {
        return "username or password invalid";
    }

    if (userInfo.tryCount >= maxTryCount) {
        return "account locked. (too many attempt / please read github document)";
    }

    if (!bcrypt.compareSync(password, userInfo.password)) {
        if (!userInfo['tryCount'])
            userInfo['tryCount'] = 0;

        userInfo['tryCount']++;
        savePassword(userList);

        return "username or password invalid";
    }

    userInfo['tryCount'] = 0;
    userInfo['lastLogin'] = dayjs().toISOString();

    savePassword(userList);

    return "";
}

export function generateRandomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }
    return result;
}


export function changePassword(user, password) {
    const userList = loadPassword();
    if (!userList[user]) {
        userList[user] = {};
    }
    let userInfo = userList[user];
    if (!password) {
        password = generateRandomString(16);
        console.log(`initial password: ${password}`);
    }
    userInfo.password = hashPassword(password);
    userInfo.tryCount = 0;
    userInfo.lastLogin = dayjs().toISOString();
    savePassword(userList);

    console.log(`change password / reset count: ${user}`);
}