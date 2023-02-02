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





var readingConnectionsChart = new Chart(document.getElementById("readingConnectionsChart"), {
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
var writingConnectionsChart = new Chart(document.getElementById("writingConnectionsChart"), {
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
var waitingConnectionsChart = new Chart(document.getElementById("waitingConnectionsChart"), {
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

function saveConfig() {
    // write to back config
    config.upstream = upstreamTextareaEditor.getValue();

    $.ajax({
        type: "POST",
        url: '/api/saveConfig',
        data: { config: JSON.stringify(config) },
        success: (ret) => {
            alert(ret);
        }
    });
}


function loadConfig() {
    $.getJSON('/api/getConfig', (ret) => {
        config = ret;

        upstreamTextareaEditor.setValue(config.upstream);
    });
}

function testConfig() {
    $.ajax({
        type: "POST",
        url: '/api/testConfig',
        data: { nginxConfig: upstreamTextareaEditor.getValue() },
        success: (ret) => {
            alert(ret);
        }
    });
}

function applyConfig() {
    $.ajax({
        type: "POST",
        url: '/api/applyConfig',
        data: { nginxConfig: upstreamTextareaEditor.getValue() },
        success: (ret) => {
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

    $.getJSON('/api/getSystemInformation', (ret) => {
        var arr = ret.filter(e => e.protocol == "tcp");
        arr = arr.filter(e => e.state != "LISTEN");
        arr = arr.filter(e => e.localAddress != "0.0.0.0");
        arr = arr.filter(e => e.localAddress != "127.0.0.1");
    });
}

updateStatus();
setInterval(updateStatus, 3000);