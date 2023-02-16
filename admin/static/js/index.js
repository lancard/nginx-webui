function createChart() {
    // Set new default font family and font color to mimic Bootstrap's default styling
    Chart.defaults.global.defaultFontFamily = 'Nunito', '-apple-system,system-ui,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
    Chart.defaults.global.defaultFontColor = '#858796';

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
            xAxes: [{
                time: {
                    unit: 'date'
                },
                gridLines: {
                    display: false,
                    drawBorder: false
                },
                ticks: {
                    maxTicksLimit: 7
                }
            }],
            yAxes: [{
                ticks: {
                    beginAtZero: true,
                    userCallback: function (label, index, labels) {
                        if (Math.floor(label) === label) {
                            return label;
                        }
                    }
                }
            }]
        },
        legend: {
            display: false
        },
        tooltips: {
            backgroundColor: "rgb(255,255,255)",
            bodyFontColor: "#858796",
            titleMarginBottom: 10,
            titleFontColor: '#6e707e',
            titleFontSize: 14,
            borderColor: '#dddfeb',
            borderWidth: 1,
            xPadding: 15,
            yPadding: 15,
            displayColors: false,
            intersect: false,
            mode: 'index',
            caretPadding: 10
        }
    };


    window.readingConnectionsChart = new Chart(document.getElementById("readingConnectionsChart"), {
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
        options: defaultOptions
    });
    window.writingConnectionsChart = new Chart(document.getElementById("writingConnectionsChart"), {
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
        options: defaultOptions
    });
    window.waitingConnectionsChart = new Chart(document.getElementById("waitingConnectionsChart"), {
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
        options: defaultOptions
    });
}

function logout() {
    $.ajax({
        type: "POST",
        url: '/api/logout',
        success: (ret) => {
            // alert(ret);

            location.href = './login.html';
        }
    });
}

function addUpstreamService() {
    var serviceName = prompt('enter service name', 'test_service');
    if (!serviceName || serviceName == '')
        return;

    $clonedObject = $("div[upstream-service].collapse").clone();
    $clonedObject.find('[upstream-service-name]').text(serviceName);
    $clonedObject.removeClass("collapse").appendTo("div[upstream-body]");
}
function deleteUpstreamService(element) {
    if (!confirm('delete?'))
        return;

    $(element).parents("[upstream-service]").remove();
}

function addBackendServer(element) {
    var backendServer = prompt('enter backend server address:port', '127.0.0.1:8080');
    if (!backendServer || backendServer == '')
        return;

    $clonedObject = $("div[upstream-node-div].collapse").clone();
    $clonedObject.find('[upstream-node-address]').text(backendServer);
    $clonedObject.removeClass("collapse").appendTo($(element).parents("div[upstream-service]").find("[upstream-node-body]"));
}

function deleteBackendServer(element) {
    if (!confirm('delete?'))
        return;

    $(element).parents("[upstream-node-div]").remove();
}

// sites
function addSite() {
    var siteName = prompt('enter site name', 'test_site');
    if (!siteName || siteName == '')
        return;

    $clonedObject = $("div[site-service].collapse").clone();
    $clonedObject.find('[site-service-name]').text(siteName);
    $clonedObject.find('[site-config]').val(`listen 80;\n# listen 443 ssl;`);
    $clonedObject.removeClass("collapse").appendTo("div[site-body]");

    // add let's encrypt well-known
    $clonedObject2 = $("div[site-node-div].collapse").clone();
    $clonedObject2.find('[site-node-address]').text('/.well-known/acme-challenge');
    $clonedObject2.find('[site-node-config]').val(`# for let's encrypt renewal\nroot /usr/share/nginx/html;`);
    $clonedObject2.removeClass("collapse").appendTo($clonedObject.find("[site-node-body]"));
}

function deleteSite(element) {
    if (!confirm('delete?'))
        return;

    $(element).parents("[site-service]").remove();
}

function addLocation(element) {
    var locationDirective = prompt('enter location', '/api');
    if (!locationDirective || locationDirective == '')
        return;

    $clonedObject = $("div[site-node-div].collapse").clone();
    $clonedObject.find('[site-node-address]').text(locationDirective);
    $clonedObject.find('[site-node-config]').val(`set $backend            http://backend_upstream;
proxy_pass              $backend;

# static resources
# root   /usr/share/nginx/html;
# index  index.html index.htm;

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
send_timeout 900;`);
    $clonedObject.removeClass("collapse").appendTo($(element).parents("div[site-service]").find("[site-node-body]"));
}

function deleteLocation(element) {
    if (!confirm('delete?'))
        return;

    $(element).parents("[site-node-div]").remove();
}

// --------------------------------------------------
function upstreamDomToConfig() {

    // common
    config.common = commonTextareaEditor.getValue();

    // upstream
    var upstream = [];
    $("[upstream-body] [upstream-service]").each((idx, e) => {
        var obj = {
            upstreamName: $(e).find("[upstream-service-name]").text(),
            nodes: []
        };

        $(e).find("[upstream-node-div").each((i, el) => {
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
    config.upstream = upstream;

    // sites
    var site = [];
    $("[site-body] [site-service]").each((idx, e) => {
        var obj = {
            siteName: $(e).find("[site-service-name]").text(),
            siteConfig: $(e).find("[site-config]").val(),
            serverName: $(e).find("[site-server-name]").val(),
            adminEmail: $(e).find("[site-admin-email]").val(),
            autoRenew: $(e).find("[site-auto-renew]").val(),
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
    config.site = site;

}

function configToUpstreamDOM() {

    // common
    commonTextareaEditor.setValue(config.common);

    // upstream
    $("[upstream-body]").empty();
    config.upstream.forEach(e => {
        $clonedObject = $("div[upstream-service].collapse").clone();
        $clonedObject.find('[upstream-service-name]').text(e.upstreamName);
        $clonedObject.removeClass("collapse").appendTo("div[upstream-body]");

        e.nodes.forEach(ee => {
            $clonedObjectNode = $("div[upstream-node-div].collapse").clone();
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
            $clonedObjectNode.removeClass("collapse").appendTo($clonedObject.find("[upstream-node-body]"));
        });
    });

    // sites
    $("[site-body]").empty();
    config.site.forEach(e => {
        $clonedObject = $("div[site-service].collapse").clone();
        $clonedObject.find('[site-service-name]').text(e.siteName);
        $clonedObject.find('[site-server-name]').val(e.serverName);
        $clonedObject.find('[site-admin-email]').val(e.adminEmail);
        $clonedObject.find('[site-auto-renew]').val(e.autoRenew);
        $clonedObject.find('[site-config]').val(e.siteConfig);
        $clonedObject.removeClass("collapse").appendTo("div[site-body]");

        e.locations.forEach(ee => {
            $clonedObjectNode = $("div[site-node-div].collapse").clone();
            $clonedObjectNode.find('[site-node-address]').text(ee.address);
            $clonedObjectNode.find('[site-node-config]').val(ee.config);
            $clonedObjectNode.removeClass("collapse").appendTo($clonedObject.find("[site-node-body]"));
        });
    });

}

function saveConfig() {
    // write to back config
    upstreamDomToConfig();

    $.ajax({
        type: "POST",
        url: '/api/saveConfig',
        data: { config: JSON.stringify(config, null, '\t') },
        success: (ret) => {
            alert(ret);
        }
    });
}

function loadConfig() {
    $.getJSON('/api/getConfig', (ret) => {
        config = ret;

        configToUpstreamDOM();
    });
}

function configToNginxConfig() {

    // common
    var nginxConfig = config.common + "\n";

    nginxConfig += `\n\n\n`;

    // upstream
    config.upstream.forEach(e => {
        nginxConfig += `upstream ${e.upstreamName} {\n`;

        e.nodes.forEach(ee => {
            nginxConfig += `  server ${ee.address} ${ee.backup ? "backup" : ""} ${ee.disable ? "down" : ""} weight=${ee.weight} max_fails=${ee.maxFails} fail_timeout=${ee.failTimeout};\n`;
        });

        nginxConfig += `\n}\n`;
    });

    nginxConfig += `\n\n\n`;

    // sites
    config.site.forEach(e => {
        nginxConfig += `# ${e.siteName}
            server { 
                ${e.siteConfig}

                server_name ${e.serverName};
                
                `;

        e.locations.forEach(ee => {
            nginxConfig += `  location ${ee.address} { \n ${ee.config} \n }\n`;
        });

        nginxConfig += `\n}\n`;
    });

    return nginxConfig;
}

function testConfig() {
    $.ajax({
        dataType: "json",
        type: "POST",
        url: '/api/testConfig',
        data: { nginxConfig: configToNginxConfig() },
        success: (ret) => {
            alert(ret.stderr);
        }
    });
}

function applyConfig() {
    if (!confirm('apply to nginx? (will try to gracefully restart)'))
        return;

    $.ajax({
        dataType: "json",
        type: "POST",
        url: '/api/applyConfig',
        data: { nginxConfig: configToNginxConfig() },
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

function getOrRenewCertFromLetsencrypt(elem) {
    var domain = $(elem).parents("[site-default-section]").find("[site-server-name]").val();

    if (domain == '') {
        alert('domain field empty');
        return;
    }

    var email = $(elem).parents("[site-default-section]").find("[site-email]").val();

    if (email == '') {
        alert('email field empty');
        return;
    }

    $.ajax({
        type: "POST",
        url: '/api/renewCert',
        data: { domain: $parent, email: email },
        success: (ret) => {
            alert(ret);
        }
    });
}

function loadCertList() {
    window.certList = {};
    $("#certList").text("");
    $.getJSON('/api/getCertList', (ret) => {
        $("#certList").text(ret.join("\n"));

        // for each site ssl exist status update
        ret.forEach(domain => {
            window.certList[domain] = true;
            $(`input[site-server-name]`).each((a, elem) => {
                if ($(elem).val() == domain) {
                    $(elem).parents("[site-default-section]").find("[site-ssl-exist]").val("YES");
                }
            })
        });
    });
}

function uploadCert() {
    if (!confirm('Are you sure you want to upload? (If file exists, it will be overwritten)'))
        return;

    $.ajax({
        type: "POST",
        url: '/api/uploadCert',
        data: { name: $("#domainName").val(), cert: $("#certFile").val(), key: $("#keyFile").val() },
        success: (ret) => {
            loadCertList();
            alert(ret);
        }
    });
}

function showPanel(selectedId) {
    $("div.container-fluid").hide();
    $("#" + selectedId).show();

    // Refresh CodeMirror
    $('.CodeMirror').each(function (i, el) {
        el.CodeMirror.refresh();
    });
}

function addData(chart, label, data) {
    chart.data.labels.push(label);
    chart.data.datasets.forEach((dataset) => {
        dataset.data.push(data);
    });
    chart.update();
}

function removeData(chart) {
    chart.data.labels.pop();
    chart.data.datasets.forEach((dataset) => {
        dataset.data.pop();
    });
    chart.update();
}

function updateStatus() {
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

        addData(readingConnectionsChart, dayjs().format("HH:mm:ss"), status.readingConnections);
        addData(writingConnectionsChart, dayjs().format("HH:mm:ss"), status.writingConnections);
        addData(waitingConnectionsChart, dayjs().format("HH:mm:ss"), status.waitingConnections);
    });

    loadCertList();

    $.getJSON('/api/getSystemInformation', (ret) => {
        var arr = ret.filter(e => e.protocol == "tcp");
        arr = arr.filter(e => e.state != "LISTEN");
        arr = arr.filter(e => e.localPort == "80" || e.localPort == "443");

        var retLine = [];
        arr.forEach(e => {
            retLine.push(`${e.peerAddress}:${e.peerPort} - ${e.state}`);
        })

        $("#osConnections").text(retLine.join("\t"));
    });
}

updateStatus();
setInterval(updateStatus, 3000);
