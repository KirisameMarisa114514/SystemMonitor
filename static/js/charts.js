import { THRESHOLDS } from "./config.js";
import { average, formatChartTime, formatRate } from "./utils.js";

const thresholdLinePlugin = {
  id: "thresholdLine",
  afterDraw(chart, _args, options) {
    const value = Number(options?.value);
    const yScale = chart.scales?.y;
    if (!Number.isFinite(value) || !yScale) return;

    const y = yScale.getPixelForValue(value);
    const { left, right } = chart.chartArea;
    const context = chart.ctx;
    context.save();
    context.beginPath();
    context.setLineDash([5, 5]);
    context.lineWidth = 1;
    context.strokeStyle = options.color;
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    context.restore();
  },
};

function themeColors() {
  const styles = getComputedStyle(document.documentElement);
  const color = (name) => styles.getPropertyValue(name).trim();
  return {
    text: color("--text-secondary"),
    grid: color("--chart-grid"),
    primary: color("--primary"),
    secondary: color("--chart-secondary"),
    warning: color("--warning"),
    tooltip: color("--chart-tooltip"),
    tooltipText: color("--page-bg"),
    border: color("--border"),
  };
}

function motionDuration() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
}

function baseOptions(colors) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    normalized: true,
    animation: { duration: motionDuration() },
    interaction: { mode: "index", intersect: false },
    elements: {
      line: { borderWidth: 2, tension: 0.28 },
      point: { radius: 0, hoverRadius: 4, hitRadius: 12 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colors.tooltip,
        titleColor: colors.tooltipText,
        bodyColor: colors.tooltipText,
        borderColor: colors.border,
        borderWidth: 1,
        padding: 10,
        displayColors: true,
      },
    },
  };
}

export class DashboardCharts {
  constructor() {
    this.available = typeof window.Chart === "function";
    this.cpu = null;
    this.network = null;
    this.rangeMs = 5 * 60 * 1000;

    if (!this.available) {
      this.showLibraryError();
      return;
    }

    const colors = themeColors();
    this.cpu = this.createCpuChart(colors);
    this.network = this.createNetworkChart(colors);
  }

  showLibraryError() {
    ["cpuChartEmpty", "networkChartEmpty"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = "图表库加载失败，关键数值仍可正常查看";
    });
  }

  createCpuChart(colors) {
    const context = document.getElementById("cpuChart");
    if (!context) return null;
    const options = baseOptions(colors);
    options.scales = {
      x: {
        grid: { display: false },
        ticks: { color: colors.text, maxTicksLimit: 7, maxRotation: 0 },
        border: { color: colors.grid },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: colors.grid },
        ticks: { color: colors.text, callback: (value) => `${value}%`, stepSize: 25 },
        border: { display: false },
      },
    };
    options.plugins.thresholdLine = {
      value: THRESHOLDS.cpu.warning,
      color: colors.warning,
    };
    options.plugins.tooltip.callbacks = {
      title: (items) => items[0]?.raw?.tooltipTime || items[0]?.label || "--",
      label: (item) => ` CPU：${Number(item.raw?.y ?? item.raw).toFixed(1)}%`,
    };

    return new window.Chart(context, {
      type: "line",
      plugins: [thresholdLinePlugin],
      data: {
        labels: [],
        datasets: [{
          label: "CPU",
          data: [],
          parsing: false,
          borderColor: colors.primary,
          backgroundColor: colors.primary,
          fill: false,
        }],
      },
      options,
    });
  }

  createNetworkChart(colors) {
    const context = document.getElementById("networkChart");
    if (!context) return null;
    const options = baseOptions(colors);
    options.scales = {
      x: {
        grid: { display: false },
        ticks: { color: colors.text, maxTicksLimit: 7, maxRotation: 0 },
        border: { color: colors.grid },
      },
      y: {
        beginAtZero: true,
        grid: { color: colors.grid },
        ticks: { color: colors.text, callback: (value) => formatRate(value), maxTicksLimit: 5 },
        border: { display: false },
      },
    };
    options.plugins.tooltip.callbacks = {
      title: (items) => items[0]?.raw?.tooltipTime || items[0]?.label || "--",
      label: (item) => ` ${item.dataset.label}：${formatRate(item.raw?.y ?? item.raw)}`,
    };

    return new window.Chart(context, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "上传",
            data: [],
            parsing: false,
            borderColor: colors.secondary,
            backgroundColor: colors.secondary,
          },
          {
            label: "下载",
            data: [],
            parsing: false,
            borderColor: colors.primary,
            backgroundColor: colors.primary,
          },
        ],
      },
      options,
    });
  }

  updateCpu(samples, rangeMs) {
    const values = samples.map((sample) => sample.value);
    const stats = {
      current: values.length ? values.at(-1) : null,
      average: average(values),
      peak: values.length ? Math.max(...values) : null,
      count: values.length,
    };
    const empty = document.getElementById("cpuChartEmpty");
    if (empty) empty.hidden = values.length > 0;
    if (!this.cpu) return stats;

    this.rangeMs = rangeMs;
    this.cpu.data.labels = samples.map((sample) => formatChartTime(sample.time, rangeMs));
    this.cpu.data.datasets[0].data = samples.map((sample) => ({
      x: formatChartTime(sample.time, rangeMs),
      y: sample.value,
      tooltipTime: new Date(sample.time).toLocaleString("zh-CN", { hour12: false }),
    }));
    this.cpu.update("none");
    return stats;
  }

  updateNetwork(samples, rangeMs) {
    const empty = document.getElementById("networkChartEmpty");
    if (empty) empty.hidden = samples.length > 0;
    if (!this.network) return;

    const labels = samples.map((sample) => formatChartTime(sample.time, rangeMs));
    this.network.data.labels = labels;
    this.network.data.datasets[0].data = samples.map((sample, index) => ({
      x: labels[index],
      y: sample.uploadRate,
      tooltipTime: new Date(sample.time).toLocaleString("zh-CN", { hour12: false }),
    }));
    this.network.data.datasets[1].data = samples.map((sample, index) => ({
      x: labels[index],
      y: sample.downloadRate,
      tooltipTime: new Date(sample.time).toLocaleString("zh-CN", { hour12: false }),
    }));
    this.network.update("none");
  }

  applyTheme() {
    if (!this.available) return;
    const colors = themeColors();
    const updateCommon = (chart) => {
      if (!chart) return;
      chart.options.scales.x.ticks.color = colors.text;
      chart.options.scales.x.border.color = colors.grid;
      chart.options.scales.y.ticks.color = colors.text;
      chart.options.scales.y.grid.color = colors.grid;
      chart.options.plugins.tooltip.backgroundColor = colors.tooltip;
      chart.options.plugins.tooltip.titleColor = colors.tooltipText;
      chart.options.plugins.tooltip.bodyColor = colors.tooltipText;
      chart.options.plugins.tooltip.borderColor = colors.border;
    };

    updateCommon(this.cpu);
    if (this.cpu) {
      this.cpu.data.datasets[0].borderColor = colors.primary;
      this.cpu.data.datasets[0].backgroundColor = colors.primary;
      this.cpu.options.plugins.thresholdLine.color = colors.warning;
      this.cpu.update("none");
    }

    updateCommon(this.network);
    if (this.network) {
      this.network.data.datasets[0].borderColor = colors.secondary;
      this.network.data.datasets[0].backgroundColor = colors.secondary;
      this.network.data.datasets[1].borderColor = colors.primary;
      this.network.data.datasets[1].backgroundColor = colors.primary;
      this.network.update("none");
    }
  }

  destroy() {
    this.cpu?.destroy();
    this.network?.destroy();
    this.cpu = null;
    this.network = null;
  }
}
