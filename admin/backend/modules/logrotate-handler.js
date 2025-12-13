import fs from 'fs';
import logger from './logger.js';
import { exec } from 'child_process';
import * as writeFileAtomic from 'write-file-atomic';

class LogrotateHandler {
    constructor(options = {}) {
        this.configPath = options.configPath || '/etc/logrotate.d/nginx';
    }

    rotateLog() {
        logger.info("log rotation start");

        try {
            exec("/etc/cron.daily/logrotate", (error, stdout, stderr) => {
                logger.info(["result", error, stdout, stderr]);
            });
        }
        catch (e) {
            logger.error(e);
        }

        logger.info("log rotation end");
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
