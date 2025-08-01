import $ from 'jquery';
import dayjs from 'dayjs';
import cloneDeep from 'lodash/cloneDeep';
import Sortable from 'sortablejs';
import { themeChange } from 'theme-change'
import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Tooltip,
    Title,
    Legend,
    CategoryScale,
} from 'chart.js';

const defaultServerDirective = `listen 443 ssl;
ssl_certificate /etc/letsencrypt/live/(domain_name)/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/(domain_name)/privkey.pem;
`;

const defaultServerLocation = `set $backend            http://test_backend_server_group;
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

themeChange();

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Tooltip,
    Title,
    Legend,
    CategoryScale,
);

class NginxWebUI {
    config = {};
    readingConnectionsChart = null;
    writingConnectionsChart = null;
    waitingConnectionsChart = null;

    handleAjaxError(jqxhr, textStatus, errorThrown) {
        console.dir("error : ", jqxhr, textStatus, errorThrown);
        if (jqxhr.status == 401) {
            alert('session ended. move to login page');
            location.href = 'login.html';
        }
    }

    createChart() {
        const defaultOptions = {
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 10,
                    right: 25,
                    top: 25,
                    bottom: 0
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: "rgb(255,255,255)",
                    bodyColor: "#858796",
                    titleMarginBottom: 10,
                    titleColor: '#6e707e',
                    titleFont: {
                        size: 14
                    },
                    borderColor: '#dddfeb',
                    borderWidth: 1,
                    padding: 15,
                    displayColors: false,
                    intersect: false,
                    mode: 'index',
                    caretPadding: 10
                },
                title: {
                    display: true,
                    text: 'Connections',
                    font: {
                        size: 18
                    },
                    padding: {
                        top: 10,
                        bottom: 30
                    },
                    align: 'center'         // center / start / end
                }
            }
        };

        const readingOption = cloneDeep(defaultOptions);
        readingOption.plugins.title.text = 'Reading Connections';
        this.readingConnectionsChart = new Chart(document.getElementById("readingConnectionsChart"), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: "Reading Connections",
                    lineTension: 0.3,
                    backgroundColor: "rgba(78, 115, 223, 0.05)",
                    borderColor: "rgba(78, 115, 223, 1)",
                    pointRadius: 3,
                    pointBackgroundColor: "rgba(78, 115, 223, 1)",
                    pointBorderColor: "rgba(78, 115, 223, 1)",
                    pointHoverRadius: 3,
                    pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
                    pointHoverBorderColor: "rgba(78, 115, 223, 1)",
                    pointHitRadius: 10,
                    pointBorderWidth: 2,
                    data: [],
                }],
            },
            options: readingOption
        });

        const writingOption = cloneDeep(defaultOptions);
        writingOption.plugins.title.text = 'Writing Connections';
        this.writingConnectionsChart = new Chart(document.getElementById("writingConnectionsChart"), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: "Reading Connections",
                    lineTension: 0.3,
                    backgroundColor: "rgba(78, 115, 223, 0.05)",
                    borderColor: "rgba(78, 115, 223, 1)",
                    pointRadius: 3,
                    pointBackgroundColor: "rgba(78, 115, 223, 1)",
                    pointBorderColor: "rgba(78, 115, 223, 1)",
                    pointHoverRadius: 3,
                    pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
                    pointHoverBorderColor: "rgba(78, 115, 223, 1)",
                    pointHitRadius: 10,
                    pointBorderWidth: 2,
                    data: [],
                }],
            },
            options: writingOption
        });

        const waitingOption = cloneDeep(defaultOptions);
        waitingOption.plugins.title.text = 'Waiting Connections';
        this.waitingConnectionsChart = new Chart(document.getElementById("waitingConnectionsChart"), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: "Reading Connections",
                    lineTension: 0.3,
                    backgroundColor: "rgba(78, 115, 223, 0.05)",
                    borderColor: "rgba(78, 115, 223, 1)",
                    pointRadius: 3,
                    pointBackgroundColor: "rgba(78, 115, 223, 1)",
                    pointBorderColor: "rgba(78, 115, 223, 1)",
                    pointHoverRadius: 3,
                    pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
                    pointHoverBorderColor: "rgba(78, 115, 223, 1)",
                    pointHitRadius: 10,
                    pointBorderWidth: 2,
                    data: [],
                }],
            },
            options: waitingOption
        });
    }

    addData(chart, label, data) {
        chart.data.labels.push(label);
        chart.data.datasets.forEach((dataset) => {
            dataset.data.push(data);
        });
        chart.update();
    }

    removeData(chart) {
        chart.data.labels.pop();
        chart.data.datasets.forEach((dataset) => {
            dataset.data.pop();
        });
        chart.update();
    }

    login() {
        $.ajax({
            type: "POST",
            url: '/api/login',
            xhrFields: {
                withCredentials: true
            },
            data: { user: $("#user").val(), password: $("#password").val() },
            success: (ret) => {
                if (ret == "OK") {
                    location.href = './index.html';
                    return;
                }

                alert(ret);
            }
        });

        return false;
    }

    logout() {
        $.ajax({
            type: "POST",
            url: '/api/logout',
            success: (ret) => {
                // alert(ret);
                location.href = 'login.html';
            }
        });
    }

    changePassword() {
        password_modal.close();

        if ($("#password_new").val() != $("#password_confirm").val()) {
            alert('password different.');
            return;
        }

        $.ajax({
            type: "POST",
            url: '/api/changePassword',
            data: { user: 'administrator', password: $("#password_new").val() },
            success: (ret) => {
                alert(ret);
            }
        });
    }

    addCertRecord(domain, email, renewal, wildcard) {
        let $clonedObject = $("tr[cert-template]").clone();
        $clonedObject.find('[cert-domain]').text(domain);
        $clonedObject.find('[cert-admin-email]').text(email);
        $clonedObject.find('[cert-auto-renewal]').val(renewal == "true" ? "true" : "false");
        $clonedObject.find('[cert-wildcard]').val(wildcard == "true" ? "true" : "false");
        $clonedObject.removeAttr('cert-template').appendTo("tbody[cert-body]");
    }

    addCertRecordFromUI() {
        var domain = prompt('enter domain name', 'test.com');
        if (!domain || domain == '')
            return;

        if (domain.indexOf("*") >= 0) {
            alert("not allow *.domain (use wildcard option)");
            return;
        }

        var adminEmail = prompt('enter admin email', 'admin@test.com');
        if (!adminEmail || adminEmail == '')
            return;

        this.addCertRecord(domain, adminEmail, "false");
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

    generateKey(elem) {
        var modal = $(elem).parents("dialog");
        var targetUpstream = $(elem).parents("[upstream-service]");
        var key = this.generateRandomString(32);
        modal.find('[modal-remark]').text("You should click save button.");
        modal.find('[modal-key]').text(key);
    }

    saveKey(elem) {
        var modal = $(elem).parents("dialog");
        var targetUpstream = $(elem).parents("[upstream-service]");
        targetUpstream.find("[upstream-auth-key]").val(modal.find('[modal-key]').text());
        modal[0].close();
    }

    addUpstreamService() {
        var serviceName = prompt('enter backend server group(service) name', 'test_service');
        if (!serviceName || serviceName == '')
            return;

        let $clonedObject = $(".template-hidden [upstream-service]").clone();
        $clonedObject.find('[upstream-service-name]').text(serviceName);
        $clonedObject.appendTo("[upstream-body]");
    }

    deleteUpstreamService(element) {
        if (!confirm('delete?'))
            return;

        $(element).parents("[upstream-service]").remove();
    }

    renameUpstreamService(element) {
        var serviceName = prompt('enter new backend server group(service) name', 'test_service');
        if (!serviceName || serviceName == '')
            return;

        $(element).parents("[upstream-service]").find('[upstream-service-name]').text(serviceName);
    }

    checkBackendServerStatus(element) {
        let backendServer = $(element).parents("[upstream-node]").find('[upstream-node-address]').text();

        $(element).parents("[upstream-node]").find('[upstream-node-status]').removeClass('status-success');
        $(element).parents("[upstream-node]").find('[upstream-node-status]').removeClass('status-error');
        $(element).parents("[upstream-node]").find('[upstream-node-status]').addClass('status-warning');

        $.ajax({
            type: "POST",
            url: '/api/checkServerStatus',
            data: { host: backendServer.split(":")[0], port: backendServer.split(":")[1] },
            success: (ret) => {
                $(element).parents("[upstream-node]").find('[upstream-node-status]').removeClass('status-warning');

                if (ret && ret.success) {
                    $(element).parents("[upstream-node]").find('[upstream-node-status]').addClass('status-success');
                }
                else {
                    $(element).parents("[upstream-node]").find('[upstream-node-status]').addClass('status-error');
                }
            }
        });
    }

    addBackendServer(element) {
        var backendServer = prompt('enter backend server address:port', '127.0.0.1:8080');
        if (!backendServer || backendServer == '')
            return;

        let $clonedObject = $(".template-hidden [upstream-node]").clone();
        $clonedObject.find('[upstream-node-address]').text(backendServer);
        $clonedObject.appendTo($(element).parents("[upstream-service]").find("[upstream-node-body]"));
    }

    deleteBackendServer(element) {
        if (!confirm('delete?'))
            return;

        $(element).parents("[upstream-node]").remove();
    }

    // sites
    addSite() {
        var siteName = prompt('enter site name', 'test_site');
        if (!siteName || siteName == '')
            return;

        var answer = confirm("Is this an HTTPS site running on port 443?\n(If you select 'Yes', we will generate example code of reverse proxy)");

        let $clonedObject = $(".template-hidden [site-service]").clone();
        $clonedObject.find('[site-service-name]').text(siteName);
        $clonedObject.find('[site-config]').val(answer ? defaultServerDirective : 'listen 80;\n');
        $clonedObject.appendTo("[site-body]");

        // add root
        let $clonedObject2 = $(".template-hidden [site-node-div]").clone();
        $clonedObject2.find('[site-node-address]').text('/');
        $clonedObject2.find('[site-node-config]').val(answer ? defaultServerLocation : '# Moved Permanently\nreturn 301 https://$host$request_uri;\n');
        $clonedObject2.appendTo($clonedObject.find("[site-node-body]"));

        if (answer) {
            alert("generated 443 port (SSL/HTTPS) default proxy site.\nif you need, change '(domain_name)' in server directive.");
        }
        else {
            alert('generated 80 port redirect site.');
        }
    }

    renameSite(element) {
        var siteName = prompt('enter new domain handler name', 'test_site_http');
        if (!siteName || siteName == '')
            return;

        $(element).parents("[site-service]").find('[site-service-name]').text(siteName);
    }

    deleteSite(element) {
        if (!confirm('delete?'))
            return;

        $(element).parents("[site-service]").remove();
    }

    addLocation(element) {
        var locationDirective = prompt('enter location', '/api');
        if (!locationDirective || locationDirective == '')
            return;

        let $clonedObject = $(".template-hidden [site-node-div]").clone();
        $clonedObject.find('[site-node-address]').text(locationDirective);
        $clonedObject.find('[site-node-config]').val(defaultServerLocation);
        $clonedObject.appendTo($(element).parents("[site-service]").find("[site-node-body]"));
    }

    deleteLocation(element) {
        if (!confirm('delete?'))
            return;

        $(element).parents("[site-node-div]").remove();
    }

    renameLocation(element) {
        const originalName = $(element).parents("[site-node-div]").find('[site-node-address]').text();

        var locationName = prompt('enter new name (rule)', originalName);
        if (!locationName || locationName == '')
            return;

        $(element).parents("[site-node-div]").find('[site-node-address]').text(locationName);
    }

    convertDomToConfig() {
        var returnConfig = {};

        // common
        returnConfig.common = $("#commonTextarea").val();

        // cert
        var cert = [];
        $("[cert-body] tr").each((idx, e) => {
            cert.push({
                domain: $(e).find("[cert-domain]").text(),
                adminEmail: $(e).find("[cert-admin-email]").text(),
                autoRenewal: $(e).find("[cert-auto-renewal]").val(),
                wildcard: $(e).find("[cert-wildcard]").val()
            });
        });
        returnConfig.cert = cert;

        // upstream
        var upstream = [];
        $("[upstream-body] [upstream-service]").each((idx, e) => {
            var obj = {
                upstreamName: $(e).find("[upstream-service-name]").text(),
                upstreamAuthKey: $(e).find("[upstream-auth-key]").val(),
                nodes: []
            };

            $(e).find("[upstream-node").each((i, el) => {
                obj.nodes.push({
                    address: $(el).find("[upstream-node-address]").text(),
                    weight: +$(el).find("[upstream-node-weight]").val(),
                    maxFails: +$(el).find("[upstream-node-maxfails]").val(),
                    failTimeout: +$(el).find("[upstream-node-failtimeout]").val(),
                    backup: $(el).find("[upstream-node-backup]").is(":checked"),
                    disable: $(el).find("[upstream-node-disable]").is(":checked")
                });
            });

            upstream.push(obj);
        });
        returnConfig.upstream = upstream;

        // sites
        var site = [];
        $("[site-body] [site-service]").each((idx, e) => {
            var obj = {
                siteName: $(e).find("[site-service-name]").text(),
                siteConfig: $(e).find("[site-config]").val(),
                serverName: $(e).find("[site-server-name]").val(),
                locations: []
            };

            $(e).find("[site-node-div").each((i, el) => {
                obj.locations.push({
                    address: $(el).find("[site-node-address]").text(),
                    config: $(el).find("[site-node-config]").val()
                });
            });

            site.push(obj);
        });
        returnConfig.site = site;

        return returnConfig;
    }

    convertConfigToDom(config) {
        // common
        $("#commonTextarea").val(config.common);

        // cert
        $("[cert-body]").empty();
        if (config.cert) {
            config.cert.forEach(e => {
                this.addCertRecord(e.domain, e.adminEmail, e.autoRenewal, e.wildcard);
            });
        }

        // upstream
        $("[upstream-body]").empty();
        if (config.upstream) {
            config.upstream.forEach(e => {
                let $clonedObject = $(".template-hidden [upstream-service]").clone();
                $clonedObject.find('[upstream-service-name]').text(e.upstreamName);
                $clonedObject.find('[upstream-auth-key]').val(e.upstreamAuthKey);
                $clonedObject.appendTo("[upstream-body]");

                e.nodes.forEach(ee => {
                    let $clonedObjectNode = $(".template-hidden [upstream-node]").clone();
                    $clonedObjectNode.find('[upstream-node-address]').text(ee.address);
                    $clonedObjectNode.find('[upstream-node-weight]').val(ee.weight);
                    $clonedObjectNode.find('[upstream-node-maxfails]').val(ee.maxFails);
                    $clonedObjectNode.find('[upstream-node-failtimeout]').val(ee.failTimeout);
                    if (ee.backup) {
                        $clonedObjectNode.find('[upstream-node-backup]').attr('checked', 'true');
                    }
                    if (ee.disable) {
                        $clonedObjectNode.find('[upstream-node-disable]').attr('checked', 'true');
                    }
                    $clonedObjectNode.appendTo($clonedObject.find("[upstream-node-body]"));
                });
            });
        }

        // sites
        $("[site-body]").empty();
        if (config.site) {
            config.site.forEach(e => {
                let $clonedObject = $(".template-hidden [site-service]").clone();
                $clonedObject.find('[site-service-name]').text(e.siteName);
                $clonedObject.find('[site-server-name]').val(e.serverName);
                $clonedObject.find('[site-config]').val(e.siteConfig);
                $clonedObject.appendTo("[site-body]");

                e.locations.forEach(ee => {
                    let $clonedObjectNode = $(".template-hidden [site-node-div]").clone();
                    $clonedObjectNode.find('[site-node-address]').text(ee.address);
                    $clonedObjectNode.find('[site-node-config]').val(ee.config);
                    $clonedObjectNode.appendTo($clonedObject.find("[site-node-body]"));
                });
            });
        }
    }

    loadLogrotate() {
        $.get('/api/getLogrotate', (ret) => {
            $("#logrotate").val(ret);
        });
    }

    saveLogrotate() {
        $.ajax({
            type: "POST",
            url: '/api/saveLogrotate',
            data: { logrotate: $("#logrotate").val() },
            success: (ret) => {
                alert(ret);
            }
        });
    }

    updatePreviewConfig() {
        // update preview
        $.ajax({
            type: "POST",
            url: '/api/previewConfig',
            data: { config: JSON.stringify(this.convertDomToConfig()) },
            success: (ret) => {
                $("#nginxPreviewConfig").val(ret.preview);
                $("#nginxCurrentConfig").val(ret.current);
            }
        });
    }

    saveConfig() {
        // check auto renewal for already generated cert
        let checkFailed = false;
        $("[cert-body] tr").each((idx, element) => {
            if ($(element).find("[cert-auto-renewal]").val() == "true" &&
                $(element).find("[cert-registered-datetime]").text() == "-") {
                alert('Only previously issued certificates are eligible for auto renewal.');
                checkFailed = true;
            }
        })

        if (checkFailed) {
            alert('abort save.');
            return;
        }

        // write to back config
        this.config = this.convertDomToConfig();

        $.ajax({
            type: "POST",
            url: '/api/saveConfig',
            data: { config: JSON.stringify(this.config, null, '\t') },
            success: (ret) => {
                if (ret == "OK") {
                    alert("save success. you can preview config in 'Preview nginx.conf' menu.");
                    this.updatePreviewConfig();
                }
                else {
                    alert(ret);
                }
            }
        });
    }

    loadConfig(callback) {
        $.ajax({
            dataType: "json",
            type: "GET",
            url: '/api/getConfig',
            success: (ret) => {
                this.config = ret;

                callback();
            },
            error: this.handleAjaxError
        });
    }

    testConfig() {
        $.ajax({
            dataType: "json",
            type: "POST",
            url: '/api/testConfig',
            success: (ret) => {
                alert(ret.stderr);
            }
        });
    }

    applyConfig() {
        if (!confirm('apply to nginx? (will try to gracefully restart)'))
            return;

        $.ajax({
            dataType: "json",
            type: "POST",
            url: '/api/applyConfig',
            success: (ret) => {
                if (ret.error == null && ret.stdout == "" && ret.stderr == "") {
                    alert("success");
                }
                else {
                    alert(ret.stderr);
                }
            }
        });
    }

    renewCertHTTP(elem) {
        var domain = $(elem).parents("tr").find("[cert-domain]").text();
        var email = $(elem).parents("tr").find("[cert-admin-email]").text();

        if (!confirm('Are you sure you want to do HTTP-challenge?'))
            return;

        alert("When the certificate issuance/renewal is completed by Let's Encrypt, it will be automatically update renewal date column.");

        $("#alert-challenge").removeClass("hidden");

        $.ajax({
            type: "POST",
            url: '/api/renewCertHTTP',
            data: { domain: domain, email: email },
            success: (ret) => {
                $("#alert-challenge").addClass("hidden");

                alert(ret);
            }
        });
    }

    renewCertDNS(elem) {
        var domain = $(elem).parents("tr").find("[cert-domain]").text();
        var email = $(elem).parents("tr").find("[cert-admin-email]").text();
        var wildcard = $(elem).parents("tr").find("[cert-wildcard]").val();

        if (!confirm("Are you sure you want to do DNS-challenge?\n(It is recommended that you be prepared to change your DNS '_acme-challenge' TXT record.)"))
            return;

        alert("When the certificate issuance/renewal is completed by Let's Encrypt, it will be automatically update renewal date column.");

        $("#alert-challenge").removeClass("hidden");

        $.ajax({
            type: "POST",
            url: '/api/renewCertDNS',
            data: { domain: domain, email: email, wildcard: wildcard },
            success: (ret) => {
                $("#alert-challenge").addClass("hidden");

                if (ret == null || ret.trim() == "") {
                    alert("certificate not yet due for renewal or error occurred.");
                    return;
                }
                prompt("paste below text to DNS TXT record", ret);
                alert("request sent. If your request is successful, the cert list below will be updated within a few minutes.");
            }
        });
    }

    changeCertEmail(element) {
        var newEmail = prompt('enter admin email', 'test@test.com');
        if (!newEmail || newEmail == '')
            return;

        $(element).parents("tr").find('[cert-admin-email]').text(newEmail);
    }

    loadCertList() {
        $.getJSON('/api/getCertList', (ret) => {
            var text = "";

            // for each site ssl exist status update
            ret.forEach(cert => {
                let found = false;
                $("tbody[cert-body] tr").each((index, element) => {
                    if ($(element).find("[cert-domain]").text() == cert.domain) {
                        found = true;
                        $(element).find("[cert-registered-datetime]").text(cert.created);
                        $(element).find("[cert-renewal-datetime]").text(cert.modified);
                    }
                });

                if (!found) {
                    this.addCertRecord(cert.domain, "notfound@notfound.com");
                }
            });
        });
    }

    deleteCert(elem) {
        var domain = $(elem).parents("tr").find("[cert-domain]").text();

        if (!confirm('Are you sure you want to delete? (Also Filesystem directory will be removed)'))
            return;

        $.ajax({
            type: "POST",
            url: '/api/deleteCert',
            data: { domain: domain },
            success: (ret) => {
                $(elem).parents("tr").remove();
                this.loadCertList();
                alert(ret);
            }
        });
    }

    uploadCert() {
        if (!confirm('Are you sure you want to upload? (If file exists, it will be overwritten)'))
            return;

        $.ajax({
            type: "POST",
            url: '/api/uploadCert',
            data: { domain: $("#domainName").val(), cert: $("#certFile").val(), key: $("#keyFile").val() },
            success: (ret) => {
                this.loadCertList();
                alert(ret);
                this.showPanel('cert');
            }
        });
    }

    showPanel(selectedId) {
        $('[data-show-panel]').removeClass("menu-active");
        $(`[data-show-panel="${selectedId}"]`).addClass("menu-active");
        $("[data-section]").addClass("hidden");
        $(`[data-section="${selectedId}"]`).removeClass("hidden");
    }

    updateStatus() {
        $.get('/api/getNginxStatus', (ret) => {
            ret = ret.split("\n");
            const status = {
                activeConnections: +ret[0].split("Active connections: ").join(""),
                acceptRequests: +ret[2].split(" ")[1],
                handledRequests: +ret[2].split(" ")[2],
                totalRequests: +ret[2].split(" ")[3],
                readingConnections: +ret[3].split(" ")[1],
                writingConnections: +ret[3].split(" ")[3],
                waitingConnections: +ret[3].split(" ")[5]
            }

            $("#acceptRequests").text(status.acceptRequests);
            $("#handledRequests").text(status.handledRequests);
            $("#totalRequests").text(status.totalRequests);
            $("#activeConnections").text(status.activeConnections);

            var now = dayjs().format("HH:mm:ss");

            this.addData(this.readingConnectionsChart, now, status.readingConnections);
            this.addData(this.writingConnectionsChart, now, status.writingConnections);
            this.addData(this.waitingConnectionsChart, now, status.waitingConnections);
        });

        this.loadCertList();

        $.getJSON('/api/getSystemInformation', (ret) => {
            var arr = ret.filter(e => e.protocol == "tcp");
            arr = arr.filter(e => e.state != "LISTEN");
            arr = arr.filter(e => e.localPort == "80" || e.localPort == "443");

            var retLine = [];
            arr.forEach(e => {
                retLine.push(`${e.peerAddress}:${e.peerPort} - ${e.state}`);
            })

            if (retLine.length == 0) {
                $("#osConnections").text("No Connection.");
            }
            else {
                $("#osConnections").text(retLine.join("\n"));
            }
        });
    }
}

$(function () {
    const instance = new NginxWebUI();

    // login.html
    if ($("#body-login").length > 0) {
        // binding
        $('#form-login').on('submit', function (e) {
            e.preventDefault();
            instance.login();
        });

        $('#eye-open,#eye-closed').on('click', function () {
            const $input = $('#password');
            const $eyeOpen = $('#eye-open');
            const $eyeClosed = $('#eye-closed');

            const isVisible = $input.attr('type') === 'text';
            $input.attr('type', isVisible ? 'password' : 'text');

            $eyeOpen.toggleClass('hidden', !isVisible);
            $eyeClosed.toggleClass('hidden', isVisible);
        });

        $.ajax({
            type: "POST",
            url: '/api/checkLogin',
            success: (ret) => {
                if ("" + ret == "true") {
                    location.href = './index.html';
                }
            }
        });
    }

    // index.html
    if ($("#body-index").length > 0) {
        // load sections
        const $sections = $('[data-section]');
        const promises = $sections.map(function () {
            const $el = $(this);
            const name = $el.data('section');
            return $.get(`section_${name}.html`)
                .done(html => $el.html(html))
                .fail(() => $el.html('<div style="color:red;">failed to load</div>'));
        }).get();

        $.when(...promises).done(function () {
            // insert save/test/apply button
            const $template = $('.template-hidden [data-save-test-apply-button-group-template]').clone();
            $('[data-save-test-apply-button-location]').html($template);

            instance.showPanel('dashboard');

            // binding
            $(document).on('click', '[data-show-panel]', function (e) {
                const panel = $(this).data('show-panel');
                instance.showPanel(panel);
            });
            $(document).on('click', '[data-click-function]', function (e) {
                const func = $(this).data('click-function');
                $("details.dropdown").prop("open", false);
                instance[func](this);
            });

            // copy template script to textarea
            $('[data-text-type]').each(function () {
                const domId = $(this).data('text-type');
                $("#" + domId).val($(this).text().trim());
            });

            // init for api key
            $('#showAuthKeyModal').on('show.bs.modal', function (event) {
                window.authKeyTarget = event.relatedTarget;
                var modal = $(this);
                var targetUpstream = $(window.authKeyTarget).parents("[upstream-service]");
                var key = targetUpstream.find("[upstream-auth-key]").val();
                modal.find('.modal-body [modal-remark]').text("");
                if (key == "") {
                    modal.find('.modal-body [modal-key]').text("(NOT EXIST, CLICK GENERATE BUTTON)");
                }
                else {
                    modal.find('.modal-body [modal-key]').text(key);
                }
            });

            instance.loadLogrotate();

            instance.loadConfig(() => {
                instance.convertConfigToDom(instance.config);
                instance.updateStatus();
                setInterval(() => instance.updateStatus(), 5000);
                instance.updatePreviewConfig();
                $("[upstream-body]").each(function () { console.log(this); Sortable.create(this, { handle: ".reorder-list-upstream" }); });
                $("[site-body]").each(function () { Sortable.create(this, { handle: ".reorder-list-site" }); });
                $("[site-node-body]").each(function () { Sortable.create(this, { handle: ".reorder-list-site-node" }); });
                $("[cert-body]").each(function () { Sortable.create(this, { handle: ".reorder-list-cert" }); });
            });

            instance.createChart();
        });
    }
});