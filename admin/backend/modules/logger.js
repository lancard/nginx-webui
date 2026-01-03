import pino from 'pino';

class Logger {
    constructor() {
        this.core = this.#createPino();
    }

    #createPino() {
        const level = "info";

        const transport = pino.transport({
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
                ignore: 'pid,hostname'
            }
        });
        
        return pino({ level, base: null, timestamp: pino.stdTimeFunctions.isoTime }, transport);
    }

    info(message, meta = {}) { this.core.info({ ...meta }, String(message)); }
    debug(message, meta = {}) { this.core.debug({ ...meta }, String(message)); }
    warn(message, meta = {}) { this.core.warn({ ...meta }, String(message)); }
    error(message, meta = {}) {
        if (message instanceof Error && message.stack) {
            this.core.error(message.stack);
        }
        else {
            this.core.error(meta, String(message));
        }
    }

    printStack() {
        const err = new Error();
        this.info('Current stack trace', { stack: err.stack });
    }
}

const logger = new Logger();
export default logger;