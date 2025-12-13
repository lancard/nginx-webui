import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import NginxBeautify from 'nginxbeautify';
import * as writeFileAtomic from 'write-file-atomic';
import { exec } from 'child_process';
import { read } from 'read-last-lines';

class NginxHandler {
    constructor(options = {}) {
        this.nginxBeautifier = new NginxBeautify();
        this.configFile = options.configFile || '/data/config.json';
    }

    loadConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.configFile));
        }
        catch (e) {
            return {};
        }
    }

    saveConfig(configText) {
        writeFileAtomic.sync(this.configFile, configText);
    }

    hasListen80(configText) {
        const regex = /^\s*listen\s+80(?:\s|;|$)/m;
        return regex.test(configText);
    }

    configToNginxConfig(config) {
        let nginxConfig = config.common + "\n";

        nginxConfig += `\n\n\n`;

        config.upstream.forEach(e => {
            nginxConfig += `upstream ${e.upstreamName} {\n`;

            e.nodes.forEach(ee => {
                nginxConfig += `  server ${ee.address} ${ee.backup ? "backup" : ""} ${ee.disable ? "down" : ""} weight=${ee.weight} max_fails=${ee.maxFails} fail_timeout=${ee.failTimeout};\n`;
            });

            nginxConfig += `\n}\n`;
        });

        nginxConfig += `\n\n\n`;

        config.site.forEach(e => {
            nginxConfig += `# ${e.siteName}\n            server { \n                ${e.serverName && e.serverName != "" ? "server_name " + e.serverName + ";" : ""}\n                ${e.siteConfig}\n                \n            `;

            let isFoundAcmeChallenge = false;

            e.locations.forEach(ee => {
                if (ee.address == "/.well-known/acme-challenge" || ee.address == "/.well-known/acme-challenge/")
                    isFoundAcmeChallenge = true;

                nginxConfig += `  location ${ee.address} { \n ${ee.config} \n }\n`;
            });

            if (!isFoundAcmeChallenge && this.hasListen80(e.siteConfig)) {
                nginxConfig += `  location /.well-known/acme-challenge { \n root /usr/share/nginx/html; \n }\n`;
            }

            nginxConfig += `  include /etc/nginx/anubis.conf;\n`;

            nginxConfig += `\n}\n`;
        });

        return nginxConfig;
    }

    generateNginxConfig() {
        let nginxConfig = fs.readFileSync('/default_config/default_nginx.conf').toString();

        nginxConfig = nginxConfig.split("#[replaced_location]").join(this.configToNginxConfig(this.loadConfig()));

        return this.nginxBeautifier.parse(nginxConfig);
    }

    generateNginxConfigFromRequest(config) {
        let nginxConfig = fs.readFileSync('/default_config/default_nginx.conf').toString();

        nginxConfig = nginxConfig.split("#[replaced_location]").join(this.configToNginxConfig(config));

        return this.nginxBeautifier.parse(nginxConfig);
    }

    testConfig(configString, callback) {
        let nginxConfig;
        try {
            if (configString) {
                let configObj = null;
                try {
                    configObj = typeof configString === 'string' ? JSON.parse(configString) : configString;
                } catch (e) {
                    // if parse fails, treat as no-op and use current config
                    configObj = null;
                }

                if (configObj) nginxConfig = this.generateNginxConfigFromRequest(configObj);
                else nginxConfig = this.generateNginxConfig();
            } else {
                nginxConfig = this.generateNginxConfig();
            }

            writeFileAtomic.sync('/default_config/nginx.conf', nginxConfig);
        } catch (e) {
            if (callback) return callback({ error: e, stdout: null, stderr: e.message });
            return;
        }

        exec("nginx -t -c /default_config/nginx.conf", (error, stdout, stderr) => {
            const obj = { error, stdout, stderr };
            if (callback) callback(obj);
        });
    }

    applyConfig(callback) {
        const nginxConfig = this.generateNginxConfig();

        writeFileAtomic.sync('/etc/nginx/nginx.conf', nginxConfig);
        writeFileAtomic.sync('/data/nginx.conf', nginxConfig);

        exec("nginx -s reload", (error, stdout, stderr) => {
            const obj = {
                error,
                stdout,
                stderr
            };

            if (callback) {
                callback(obj);
            }
        });
    }

    reloadNginx(callback) {
        exec("nginx -s reload", (error, stdout, stderr) => {
            const obj = {
                error,
                stdout,
                stderr
            };

            if (callback) {
                callback(obj);
            }
        });
    }

    getNginxAccessLog(lines = 1000) {
        return read('/var/log/nginx/access.log', lines);
    }

    getNginxErrorLog(lines = 1000) {
        return read('/var/log/nginx/error.log', lines);
    }

    getCurrentConfig() {
        return fs.readFileSync('/etc/nginx/nginx.conf').toString();
    }

    getBackupConfig() {
        return fs.readFileSync('/data/nginx.conf').toString();
    }
}

const defaultHandler = new NginxHandler();
export default defaultHandler;
