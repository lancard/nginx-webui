import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

class CryptoHandler {
    constructor(options = {}) {
        this.saltRounds = options.saltRounds ?? 7;
    }

    hashPassword(plainPassword) {
        return bcrypt.hashSync(plainPassword, this.saltRounds);
    }

    comparePassword(plainPassword, hash) {
        return bcrypt.compareSync(plainPassword, hash);
    }

    generateRandomHex(len = 16) {
        return randomBytes(len).toString('hex');
    }
}

const defaultHandler = new CryptoHandler();
export default defaultHandler;
