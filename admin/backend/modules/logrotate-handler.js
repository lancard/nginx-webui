import fs from 'fs';
import logger from './logger.js';
import { exec } from 'child_process';
import * as writeFileAtomic from 'write-file-atomic';

class LogrotateHandler {
    constructor(options = {}) {
        this.configPath = options.configPath || '/data/logrotate.conf';
    }

    rotateLog() {
        try {
            exec("/usr/sbin/logrotate /data/logrotate.conf", (error, stdout, stderr) => {
                // logger.info(["result", error, stdout, stderr]);
                logger.info("log rotation executed");
            });
        }
        catch (e) {
            logger.error(e);
        }
    }

    getLogrotate() {
        return fs.readFileSync(this.configPath).toString();
    }

    saveLogrotate(content) {
        writeFileAtomic.sync(this.configPath, content);
    }
}

const defaultHandler = new LogrotateHandler();
export default defaultHandler;
