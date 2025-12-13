import cloneDeep from 'lodash/cloneDeep';
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

class ChartHandler {
    constructor() {
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

        this.readingConnectionsChart = null;
        this.writingConnectionsChart = null;
        this.waitingConnectionsChart = null;
    }

    initCharts() {
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

    addChartData(chartName, label, data) {
        const chart = this[chartName];
        chart.data.labels.push(label);
        chart.data.datasets.forEach((dataset) => {
            dataset.data.push(data);
        });
        chart.update();
    }

    trimChartData(chartName) {
        const chart = this[chartName];
        chart.data.labels.pop();
        chart.data.datasets.forEach((dataset) => {
            dataset.data.pop();
        });
        chart.update();
    }
}

const chartHandler = new ChartHandler();
export default chartHandler;