import dayjs from 'dayjs';
import Alpine from 'alpinejs';
import sort from '@alpinejs/sort'
import { themeChange } from 'theme-change'

import chartHandler from './modules/chart-handler.js';

const defaultServerDirective = `listen 443 ssl;
listen [::]:443 ssl;
ssl_certificate /data/cert/test.com/fullchain.pem;
ssl_certificate_key /data/cert/test.com/privkey.pem;
`;

const defaultServerLocation = `# To enable Anubis, please remove the commented lines below.
# auth_request            /.anubis;
# error_page              401 = @anubis;

set $backend            http://test_backend_server_group;
proxy_pass              $backend;

proxy_set_header        Host $host:$server_port;
proxy_set_header        X-Real-IP $remote_addr;
proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header        X-Forwarded-Proto $scheme;

# Required for new HTTP-based CLI
proxy_http_version 1.1;
proxy_request_buffering off;
proxy_buffering off; # Required for HTTP-based CLI to work over SSL

# timeout
proxy_connect_timeout 900;
proxy_send_timeout 900;
proxy_read_timeout 900;
send_timeout 900;

# serve static file
# root /usr/share/nginx/html;

# cache (need 'proxy_buffering on' if you want to use)
# proxy_cache nginxcache;
# proxy_ignore_headers Cache-Control Expires Set-Cookie;
# proxy_cache_revalidate on;
# proxy_cache_lock on;
# proxy_cache_valid 200 301 302 1m; # 1min
# proxy_cache_use_stale error timeout http_500 http_502 http_503 http_504;
# proxy_cache_background_update on;
# add_header X-CACHE-STATUS $upstream_cache_status;
`;

const sampleCert = `-----BEGIN CERTIFICATE-----
ABCDEFGSAMPLE...
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
ABCDEFGSAMPLE...
-----END CERTIFICATE-----`;

const sampleKey = `-----BEGIN PRIVATE KEY-----
ABCDEFGSAMPLE...
-----END PRIVATE KEY-----`;


class FrontendApp {
    constructor() {
        themeChange();

        this.uiComponent = {};

        // for login page
        this.uiComponent.login = {
            user: 'administrator',
            password: '',
            showPassword: false
        }

        // for main data
        this.main = {
            logrotate: '',
            nginx: {
                common: '',
                cert: [],
                upstream: [],
                site: []
            },
        };

        // for main ui component
        this.uiComponent.main = {
            theme: '',
            selectedMenu: 'dashboard',
            changePassword: {
                password: '',
                passwordConfirm: ''
            },
            showNginxButtonGroup: false,
            connectionList: [],
            nginxPreview: {
                current: '',
                preview: ''
            },
            backendServerStatus: {},
            nginxStatus: {},
            certRefreshing: false,
            certUpload: {
                domain: 'test.com',
                cert: sampleCert,
                key: sampleKey
            }
        }

    }

    handleAjaxError(jqxhr, textStatus, errorThrown) {
        console.dir("error : ", jqxhr, textStatus, errorThrown);
        if (jqxhr.status == 401) {
            alert('session ended. move to login page');
            location.href = 'login.html';
        }
    }


    showError(error) {
        alert("error : " + error.toString());
    }

    login() {
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ user: this.uiComponent.login.user, password: this.uiComponent.login.password })
        })
            .then(res => res.json())
            .then(ret => {
                if (ret.success) {
                    location.href = './index.html';
                    return;
                }

                alert(ret.errorMessage);
            })
            .catch(this.showError);
    }

    logout() {
        fetch('/api/logout', { method: 'POST' })
            .then(() => { location.href = 'login.html'; })
            .catch(this.showError);
    }

    changePassword() {
        if (this.uiComponent.main.changePassword.password != this.uiComponent.main.changePassword.passwordConfirm) {
            alert('password different.');
            return;
        }

        password_modal.close();

        fetch('/api/changePassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ user: 'administrator', password: this.uiComponent.main.changePassword.password })
        })
            .then(res => res.json())
            .then(ret => {
                this.uiComponent.main.changePassword.password = '';
                this.uiComponent.main.changePassword.passwordConfirm = '';
                alert('changed.');
            })
            .catch(err => console.error(err));
    }

    addCertRecordFromUI() {
        var domain = prompt('enter domain name', 'test.com');
        if (!domain || domain == '') {
            alert('aborted');
            return;
        }

        if (domain.indexOf("*") >= 0) {
            alert("not allow *.domain (use wildcard option)");
            return;
        }

        var adminEmail = prompt('enter admin email', 'admin@test.com');
        if (!adminEmail || adminEmail == '') {
            alert('aborted');
            return;
        }

        this.main.nginx.cert.push({ domain: domain, adminEmail: adminEmail, autoRenewal: "false", wildcard: "false" });
    }


    generateRandomString(length) {
        const byteLength = Math.ceil(length / 2);
        const array = new Uint8Array(byteLength);
        crypto.getRandomValues(array);

        const hex = [...array]
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .slice(0, length);

        return hex;
    }

    generateKey(upstream) {
        upstream.upstreamAuthKey = this.generateRandomString(32);
    }

    copyKey(upstream) {
        navigator.clipboard.writeText(upstream.upstreamAuthKey).then(() => { alert('copied!'); });
    }

    confirmKey(elem) {
        alert('click green save button to save changes.');
        // find dialog parents
        elem.closest('dialog').close();
    }

    openKeyDialog(elem) {
        elem.nextElementSibling.showModal();
    }

    addUpstreamService() {
        var serviceName = prompt('enter backend server group(service) name', 'test_service');
        if (!serviceName || serviceName == '') {
            alert('aborted');
            return;
        }
        this.main.nginx.upstream.push({ upstreamName: serviceName, upstreamAuthKey: '', nodes: [] });
    }

    deleteUpstreamService(upstream) {
        if (!confirm('delete?'))
            return;

        this.main.nginx.upstream = this.main.nginx.upstream.filter(e => e != upstream);
    }

    renameUpstreamService(upstream) {
        var serviceName = prompt('enter new backend server group(service) name', 'test_service');
        if (!serviceName || serviceName == '') {
            alert('aborted');
            return;
        }

        upstream.upstreamName = serviceName;
    }

    checkBackendServerStatus(backendServer) {
        this.uiComponent.main.backendServerStatus[backendServer] = 'CHECKING';

        fetch('/api/checkServerStatus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ host: backendServer.split(":")[0], port: backendServer.split(":")[1] })
        })
            .then(res => res.json())
            .then(ret => {
                if (ret && ret.success) {
                    this.uiComponent.main.backendServerStatus[backendServer] = 'SUCCESS';
                }
                else {
                    this.uiComponent.main.backendServerStatus[backendServer] = 'FAILED';
                }
            })
            .catch(err => console.error(err));
    }

    addBackendServer(upstream) {
        var backendServer = prompt('enter backend server address:port', '127.0.0.1:8080');
        if (!backendServer || backendServer == '') {
            alert('aborted');
            return;
        }
        upstream.nodes.push({ address: backendServer, weight: 1, maxFails: 3, failTimeout: 30, backup: false, disable: false });
    }

    deleteBackendServer(upstream, backendServer) {
        if (!confirm('delete?'))
            return;

        upstream.nodes = upstream.nodes.filter(e => e != backendServer);
    }

    // sites
    addSite() {
        var siteName = prompt('enter site name', 'test_site_https');
        if (!siteName || siteName == '') {
            alert('aborted');
            return;
        }

        var answer = confirm("Is this an HTTPS site running on port 443?\n(If you select 'Yes', we will generate example code of reverse proxy)");

        this.main.nginx.site.push({
            siteName: siteName,
            serverName: 'test.com',
            siteConfig: answer ? defaultServerDirective : 'listen 80;\nlisten [::]:80;\n',
            locations: [{
                address: '/',
                config: answer ? defaultServerLocation : '# Moved Permanently\nreturn 301 https://$host$request_uri;\n'
            }]
        });

        if (answer) {
            alert("generated 443 port (SSL/HTTPS) default proxy site.\nif you need, change '(domain_name)' in server directive.");
        }
        else {
            alert('generated 80 port redirect site.');
        }
    }

    renameSite(site) {
        var siteName = prompt('enter new domain handler name', 'test_site_http');
        if (!siteName || siteName == '') {
            alert('aborted');
            return;
        }

        site.siteName = siteName;
    }

    deleteSite(site) {
        if (!confirm('delete?'))
            return;

        this.main.nginx.site = this.main.nginx.site.filter(e => e != site);
    }

    addLocation(site) {
        var locationDirective = prompt('enter location', '/api');
        if (!locationDirective || locationDirective == '') {
            alert('aborted');
            return;
        }

        site.locations.push({ address: locationDirective, config: defaultServerLocation });
    }

    deleteLocation(site, node) {
        if (!confirm('delete?'))
            return;

        site.locations = site.locations.filter(e => e != node);
    }

    renameLocation(node) {
        var locationName = prompt('enter new name (rule)', node.address);
        if (!locationName || locationName == '') {
            alert('aborted');
            return;
        }

        node.address = locationName;
    }

    viewNginxLog() {
        nginxAccessLog.value = "Loading...";
        nginxErrorLog.value = "Loading...";

        fetch('/api/getNginxAccessLog')
            .then(res => res.text())
            .then(ret => {
                nginxAccessLog.value = ret;
                nginxAccessLog.scrollTop = nginxAccessLog.scrollHeight;
            })
            .catch(err => console.error(err));
        fetch('/api/getNginxErrorLog')
            .then(res => res.text())
            .then(ret => {
                nginxErrorLog.value = ret;
                nginxErrorLog.scrollTop = nginxErrorLog.scrollHeight;
            })
            .catch(err => console.error(err));
    }

    loadLogrotate() {
        fetch('/api/getLogrotate')
            .then(res => res.text())
            .then(ret => { this.main.logrotate = ret; })
            .catch(err => console.error(err));
    }

    saveLogrotate() {
        fetch('/api/saveLogrotate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ logrotate: this.main.logrotate })
        })
            .then(res => res.json())
            .then(ret => alert("saved."))
            .catch(err => console.error(err));
    }

    updatePreviewConfig() {
        // update preview
        fetch('/api/previewConfig', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ config: JSON.stringify(this.main.nginx) })
        })
            .then(res => res.json())
            .then(ret => {
                this.uiComponent.main.nginxPreview = ret;
            })
            .catch(err => console.error(err));
    }

    async loadConfig() {
        return fetch('/api/getConfig')
            .then(res => {
                if (res.status === 401) {
                    this.handleAjaxError(res, 'error', null);
                    throw new Error('unauthorized');
                }
                return res.json();
            });
    }

    saveConfig() {
        // check auto renewal for already generated cert
        let checkFailed = false;
        this.main.nginx.cert.forEach(cert => {
            if (cert.autoRenewal == "true" &&
                (cert.created == null || !cert.created || cert.created == "")) {
                alert('Only previously issued certificates are eligible for auto renewal: ' + cert.domain);
                checkFailed = true;
            }
        });

        if (checkFailed) {
            alert('abort save.');
            return;
        }

        fetch('/api/saveConfig', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ config: JSON.stringify(this.main.nginx, null, '\t') })
        })
            .then(res => res.json())
            .then(ret => {
                if (ret.success) {
                    alert("save success. you can preview config in 'Preview nginx.conf' menu.");
                    this.updatePreviewConfig();
                }
                else {
                    alert(ret);
                }
            })
            .catch(err => console.error(err));
    }

    testConfig() {
        fetch('/api/testConfig', { method: 'POST' })
            .then(res => res.json())
            .then(ret => { alert(ret.stderr); })
            .catch(err => console.error(err));
    }

    applyConfig() {
        if (!confirm('apply to nginx? (will try to gracefully restart)'))
            return;

        fetch('/api/applyConfig', { method: 'POST' })
            .then(res => res.json())
            .then(ret => {
                if (ret.error == null && ret.stdout == "" && ret.stderr == "") {
                    alert("success");
                }
                else {
                    alert(ret.stderr);
                }
            })
            .catch(err => console.error(err));
    }

    renewCertHTTP(item) {
        if (item.domain == 'localhost_nginx_webui') {
            alert("localhost_nginx_webui certificate cannot be renewed.");
            return;
        }

        if (!confirm('Are you sure you want to do HTTP-challenge?'))
            return;

        alert("When the certificate issuance/renewal is completed by Let's Encrypt, it will be automatically update renewal date column.");

        this.uiComponent.main.certRefreshing = true;

        fetch('/api/renewCertHTTP', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ domain: item.domain, email: item.adminEmail })
        })
            .then(res => res.text())
            .then(ret => {
                alert(ret);
                this.uiComponent.main.certRefreshing = false;
            })
            .catch(err => console.error(err));
    }

    renewCertDNS(item) {
        if (item.domain == 'localhost_nginx_webui') {
            alert("localhost_nginx_webui certificate cannot be renewed.");
            return;
        }

        if (!confirm("Are you sure you want to do DNS-challenge?\n(It is recommended that you be prepared to change your DNS '_acme-challenge' TXT record.)"))
            return;

        alert("When the certificate issuance/renewal is completed by Let's Encrypt, it will be automatically update renewal date column.");

        this.uiComponent.main.certRefreshing = true;

        fetch('/api/renewCertDNS', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ domain: item.domain, email: item.adminEmail, wildcard: item.wildcard })
        })
            .then(res => res.text())
            .then(ret => {
                if (ret == null || ret.trim() == "") {
                    alert("certificate not yet due for renewal or error occurred.");
                    return;
                }
                prompt("paste below text to DNS TXT record", ret);
                alert("request sent. If your request is successful, the cert list below will be updated within a few minutes.");
                this.uiComponent.main.certRefreshing = false;
            })
            .catch(err => console.error(err));
    }

    changeCertEmail(item) {
        var newEmail = prompt('enter admin email', 'test@test.com');
        if (!newEmail || newEmail == '') {
            alert('aborted');
            return;
        }

        item.adminEmail = newEmail;
    }

    updateCertListFromFileStatus() {
        fetch('/api/getCertList')
            .then(res => res.json())
            .then((ret) => {
                // update cert list
                this.main.nginx.cert.forEach(cert => {
                    ret.forEach(status => {
                        if (cert.domain == status.domain) {
                            cert.created = status.created;
                            cert.modified = status.modified;
                        }
                    });
                });

                // add new cert from file status
                ret.forEach(status => {
                    let found = false;
                    this.main.nginx.cert.forEach(cert => {
                        if (cert.domain == status.domain) {
                            found = true;
                        }
                    });

                    if (!found) {
                        this.main.nginx.cert.push({
                            domain: status.domain,
                            adminEmail: 'notfound@notfound.com',
                            autoRenewal: 'false',
                            wildcard: 'false',
                            created: status.created,
                            modified: status.modified
                        });
                    }
                });
            })
            .catch(err => console.error(err));
    }

    deleteCert(item) {
        if (!confirm('Are you sure you want to delete? (Also Filesystem directory will be removed)'))
            return;

        fetch('/api/deleteCert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ domain: item.domain })
        })
            .then(res => res.json())
            .then(ret => {
                if (ret.success) {
                    // delete item from list
                    this.main.nginx.cert = this.main.nginx.cert.filter(e => e.domain != item.domain);
                    this.updateCertListFromFileStatus();
                    alert('deleted');
                }
            })
            .catch(err => console.error(err));
    }

    uploadCert() {
        if (!confirm('Are you sure you want to upload? (If file exists, it will be overwritten)'))
            return;

        fetch('/api/uploadCert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                domain: this.uiComponent.main.certUpload.domain,
                cert: this.uiComponent.main.certUpload.cert,
                key: this.uiComponent.main.certUpload.key
            })
        })
            .then(res => res.json())
            .then(ret => {
                if (ret.success) {
                    this.updateCertListFromFileStatus();
                    alert('upload success');
                    this.uiComponent.main.selectedMenu = 'cert';
                }
            })
            .catch(err => console.error(err));
    }

    updateStatus() {
        fetch('/api/getNginxStatus')
            .then(res => res.text())
            .then(ret => {
                ret = ret.split("\n");
                this.uiComponent.main.nginxStatus = {
                    activeConnections: +ret[0].split("Active connections: ").join(""),
                    acceptRequests: +ret[2].split(" ")[1],
                    handledRequests: +ret[2].split(" ")[2],
                    totalRequests: +ret[2].split(" ")[3],
                    readingConnections: +ret[3].split(" ")[1],
                    writingConnections: +ret[3].split(" ")[3],
                    waitingConnections: +ret[3].split(" ")[5]
                };

                var now = dayjs().format("HH:mm:ss");

                chartHandler.addChartData("readingConnectionsChart", now, this.uiComponent.main.nginxStatus.readingConnections);
                chartHandler.addChartData("writingConnectionsChart", now, this.uiComponent.main.nginxStatus.writingConnections);
                chartHandler.addChartData("waitingConnectionsChart", now, this.uiComponent.main.nginxStatus.waitingConnections);
            })
            .catch(err => console.error(err));

        this.updateCertListFromFileStatus();

        fetch('/api/getSystemInformation')
            .then(res => {
                if (res.status === 401) {
                    this.handleAjaxError(res, 'error', null);
                    throw new Error('unauthorized');
                }
                return res.json();
            })
            .then((ret) => {
                let arr = ret.filter(e => e.protocol == "tcp");
                arr = arr.filter(e => e.state != "LISTEN" && e.state != "TIME_WAIT");
                // arr = arr.filter(e => e.localPort == "8080" || e.localPort == "443");
                this.uiComponent.main.connectionList = arr;
            })
            .catch(err => { if (err.message !== 'unauthorized') this.handleAjaxError(err, 'error', null); });
    }

    // login.html
    initLoginPage() {
        fetch('/api/checkLogin', { method: 'POST' })
            .then(res => res.text())
            .then(ret => {
                if ("" + ret == "true") {
                    location.href = './index.html';
                }
            })
            .catch(err => console.error(err));
    }

    onChangeThemeSelect() {
        if (this.uiComponent.main.theme == '') {
            this.$nextTick(() => {
                document.documentElement.removeAttribute('data-theme');
                localStorage.removeItem('theme');
                console.log('ok');
            });
        }
    }

    loadSections() {
        const promises = [];

        for (const section of this.$refs.sectionContainer.children) {
            const name = section.dataset.sectionName;

            promises.push(
                fetch(`section_${name}.html`)
                    .then(res => res.text())
                    .then(html => { section.innerHTML = html; Alpine.initTree(section); })
                    .catch(() => { section.innerHTML = '<div style="color:red;">failed to load</div>'; })
            );
        };

        return Promise.all(promises);
    }

    onSorted(itemIndexPlusOne, position, container, key) {
        const list = container[key];
        container[key] = [];
        const itemIndex = itemIndexPlusOne - 1;
        const [item] = list.splice(itemIndex, 1);
        list.splice(position, 0, item);
        this.$nextTick(() => {
            container[key] = list;
        });
    }

    init() {
        if (location.pathname.endsWith('login.html')) {
            return;
        }

        // load sections
        this.$nextTick(() => {
            this.loadSections().then(() => {
                this.loadLogrotate();

                this.loadConfig().then((config) => {
                    this.main.nginx = config;
                    this.updateStatus();
                    setInterval(() => this.updateStatus(), 5000);
                    this.updatePreviewConfig();
                    chartHandler.initCharts();
                });
            });
        });
    }
}


// global initialize -------------------------------------------------
window.Alpine = Alpine;
Alpine.plugin(sort);
Alpine.data('app', () => { return new FrontendApp(); });
Alpine.start();