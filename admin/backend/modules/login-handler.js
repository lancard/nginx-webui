import fs from 'fs';
import dayjs from 'dayjs';
import logger from './logger.js';
import cryptoHandler from './crypto-handler.js';
import * as writeFileAtomic from 'write-file-atomic';

class LoginHandler {
    constructor(options = {}) {
        this.usernameBlacklist = ['__proto__', 'constructor', 'prototype'];
        this.passwordFile = options.passwordFile ?? '/data/password.json';
        this.maxTryCount = options.maxTryCount ?? 20;
    }

    loadPassword() {
        try {
            return JSON.parse(fs.readFileSync(this.passwordFile));
        }
        catch (e) {
            return {};
        }
    }

    savePassword(configPassowrd) {
        writeFileAtomic.sync(this.passwordFile, JSON.stringify(configPassowrd, null, '\t'));
    }

    tryCheckPassword(user, password) {
        if (this.usernameBlacklist.includes(user)) {
            return 'refusing to set dangerous property';
        }

        const userList = this.loadPassword();
        let userInfo = userList[user];

        if (!userInfo) {
            return 'username or password invalid';
        }

        if (userInfo.tryCount >= this.maxTryCount) {
            return 'account locked. (too many attempt / please read github document)';
        }

        if (!cryptoHandler.comparePassword(password, userInfo.password)) {
            if (!userInfo.tryCount)
                userInfo.tryCount = 0;

            userInfo.tryCount++;
            this.savePassword(userList);

            return 'username or password invalid';
        }

        userInfo.tryCount = 0;
        userInfo.lastLogin = dayjs().toISOString();

        this.savePassword(userList);

        return '';
    }

    changePassword(user, password) {
        if (this.usernameBlacklist.includes(user)) {
            logger.error('refusing to set dangerous property');
            return;
        }

        const userList = this.loadPassword();
        if (!userList[user] || !password) {
            return 'no user or no password.';
        }
        let userInfo = userList[user];
        userInfo.password = cryptoHandler.hashPassword(password);
        userInfo.tryCount = 0;
        this.savePassword(userList);

        logger.info(`changed user password: ${user}`);
    }

    resetPassword(user) {
        if (this.usernameBlacklist.includes(user)) {
            logger.error('refusing to set dangerous property');
            return;
        }

        const userList = this.loadPassword();
        if (!userList[user]) {
            userList[user] = {};
        }
        let userInfo = userList[user];
        let password = cryptoHandler.generateRandomHex(16);
        logger.info(`initial password: ${password}`);

        userInfo.password = cryptoHandler.hashPassword(password);
        userInfo.tryCount = 0;
        userInfo.lastLogin = dayjs().toISOString();
        this.savePassword(userList);
        logger.info(`change password and reset count: ${user}`);
    }
}

const defaultHandler = new LoginHandler();
export default defaultHandler;