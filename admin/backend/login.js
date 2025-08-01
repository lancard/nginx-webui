import fs from 'fs';
import * as writeFileAtomic from 'write-file-atomic';
import dayjs from 'dayjs';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

const saltRounds = 7;
const passwordFile = '/data/password.json';
const maxTryCount = 20;
export const usernameBlacklist = ['__proto__', 'constructor', 'prototype'];

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
    writeFileAtomic.sync(passwordFile, JSON.stringify(configPassowrd, null, '\t'));
}

export function tryCheckPassword(user, password) {
    if (usernameBlacklist.includes(user)) {
        return "refusing to set dangerous property";
    }

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

export function changePassword(user, password) {
    if (usernameBlacklist.includes(user)) {
        console.log('refusing to set dangerous property');
        return;
    }

    const userList = loadPassword();
    if (!userList[user] || !password) {
        return "no user or no password.";
    }
    let userInfo = userList[user];
    userInfo.password = hashPassword(password);
    userInfo.tryCount = 0;
    savePassword(userList);

    console.log(`change password: ${user}`);
}

export function resetPassword(user) {
    if (usernameBlacklist.includes(user)) {
        console.log('refusing to set dangerous property');
        return;
    }

    const userList = loadPassword();
    if (!userList[user]) {
        userList[user] = {};
    }
    let userInfo = userList[user];
    password = randomBytes(16).toString('hex');
    console.log(`initial password: ${password}`);

    userInfo.password = hashPassword(password);
    userInfo.tryCount = 0;
    userInfo.lastLogin = dayjs().toISOString();
    savePassword(userList);

    console.log(`change password and reset count: ${user}`);
}