import {
  DEFAULT_REFRESH_INTERVAL,
  REFRESH_INTERVALS,
  THEME_STORAGE_KEY,
  THRESHOLDS,
  TIME_RANGES,
} from "./config.js";
import { MonitorApi } from "./api.js";
import { DashboardCharts } from "./charts.js";
import { DashboardRenderer, ProcessTable, showToast } from "./components.js";
import { NetworkRateCalculator, TimeSeriesQueue } from "./history.js";
import { errorMessage, formatTimestamp, setText, toFiniteNumber } from "./utils.js";

const api = new MonitorApi();
const charts = new DashboardCharts();
const renderer = new DashboardRenderer();
const processTable = new ProcessTable();
const cpuHistory = new TimeSeriesQueue();
const networkHistory = new TimeSeriesQueue();
const networkRateCalculator = new NetworkRateCalculator();

const state = {
  snapshot: {
    system: null,
    cpu: null,
    memory: null,
    disks: [],
    network: null,
  },
  currentNetwork: null,
  rangeMs: TIME_RANGES.fiveMinutes,
  refreshInterval: DEFAULT_REFRESH_INTERVAL,
  autoRefresh: true,
  timer: null,
  activeRequest: null,
  consecutiveFailures: 0,
  lastSuccessfulUpdate: null,
  destroyed: false,
};

const endpointNames = {
  system: "系统摘要",
  cpu: "CPU",
  memory: "内存",
  disks: "磁盘",
  network: "网络",
  processes: "进程",
};

function setConnection(connectionState, label) {
  const indicator = document.getElementById("connectionIndicator");
  if (indicator) indicator.dataset.state = connectionState;
  setText("connectionText", label);
}

function renderFailureCount() {
  const element = document.getElementById("failureCount");
  if (!element) return;
  element.hidden = state.consecutiveFailures === 0;
  element.textContent =
    state.consecutiveFailures > 0 ? `连续异常 ${state.consecutiveFailures} 次` : "";
}

function renderLastUpdated() {
  const element = document.getElementById("lastUpdated");
  if (!element || !state.lastSuccessfulUpdate) return;
  element.textContent = formatTimestamp(state.lastSuccessfulUpdate, { withDate: false });
  element.dateTime = new Date(state.lastSuccessfulUpdate).toISOString();
  element.title = new Date(state.lastSuccessfulUpdate).toLocaleString("zh-CN", { hour12: false });
}

function renderCharts() {
  const now = Date.now();
  const cpuSamples = cpuHistory.within(state.rangeMs, now);
  const networkSamples = networkHistory.within(state.rangeMs, now);
  renderer.renderCpuStats(charts.updateCpu(cpuSamples, state.rangeMs));
  charts.updateNetwork(networkSamples, state.rangeMs);
}

function renderAll() {
  renderer.render(state.snapshot, state.currentNetwork);
  renderCharts();
  renderLastUpdated();
  renderFailureCount();
}

function recordSuccessfulData(data) {
  Object.entries(data).forEach(([key, value]) => {
    if (key !== "processes") state.snapshot[key] = value;
  });

  if (data.cpu && toFiniteNumber(data.cpu.percent) !== null) {
    cpuHistory.push({
      time: (toFiniteNumber(data.cpu.sampleTime) || Date.now() / 1000) * 1000,
      value: data.cpu.percent,
    });
  }

  if (data.network) {
    state.currentNetwork = networkRateCalculator.calculate(data.network);
    networkHistory.push(state.currentNetwork);
  }

  if (data.processes) {
    processTable.setData(data.processes, state.snapshot.system?.processCount);
  }
}

function summarizeErrors(errors) {
  const names = Object.keys(errors).map((key) => endpointNames[key] || key);
  if (!names.length) return "监控接口请求失败";
  return `${names.join("、")}数据暂时不可用`;
}

async function performRefresh() {
  const refreshButton = document.getElementById("refreshButton");
  refreshButton?.classList.add("is-loading");
  refreshButton?.setAttribute("aria-busy", "true");
  processTable.setLoading();

  if (!state.lastSuccessfulUpdate) setConnection("connecting", "正在连接");

  try {
    const result = await api.getSnapshot();
    if (state.destroyed) return;

    const hadFailures = state.consecutiveFailures > 0;
    if (result.successCount > 0) {
      recordSuccessfulData(result.data);
      state.lastSuccessfulUpdate = Date.now();
    }

    if (result.successCount === result.totalCount) {
      state.consecutiveFailures = 0;
      setConnection("live", "实时");
      if (hadFailures) showToast("监控接口连接已恢复", "success");
    } else {
      state.consecutiveFailures += 1;
      const status =
        result.successCount === 0 && state.consecutiveFailures >= 3
          ? "disconnected"
          : "delayed";
      setConnection(status, status === "disconnected" ? "已断开" : "数据延迟");
      const message = summarizeErrors(result.errors);
      if (state.consecutiveFailures === 1 || state.consecutiveFailures % 5 === 0) {
        showToast(message, "error");
      }
    }

    if (result.errors.processes) {
      processTable.setError(result.errors.processes);
    } else if (!result.data.processes && result.successCount === 0) {
      processTable.setError(new Error("监控接口没有返回数据"));
    }

    renderAll();
  } catch (error) {
    if (state.destroyed) return;
    state.consecutiveFailures += 1;
    const disconnected = state.consecutiveFailures >= 3;
    setConnection(disconnected ? "disconnected" : "delayed", disconnected ? "已断开" : "数据延迟");
    processTable.setError(error);
    renderFailureCount();
    if (state.consecutiveFailures === 1 || state.consecutiveFailures % 5 === 0) {
      showToast(`刷新失败：${errorMessage(error)}`, "error");
    }
  } finally {
    refreshButton?.classList.remove("is-loading");
    refreshButton?.removeAttribute("aria-busy");
  }
}

function refresh() {
  if (state.activeRequest) return state.activeRequest;
  state.activeRequest = performRefresh().finally(() => {
    state.activeRequest = null;
  });
  return state.activeRequest;
}

function clearRefreshTimer() {
  if (state.timer) {
    window.clearTimeout(state.timer);
    state.timer = null;
  }
}

function updateAutoRefreshLabel() {
  if (document.hidden && state.autoRefresh) {
    setText("autoRefreshStatus", "后台已暂停");
  } else if (!state.autoRefresh) {
    setText("autoRefreshStatus", "已暂停");
  } else {
    setText("autoRefreshStatus", `每 ${state.refreshInterval / 1000} 秒`);
  }
}

function scheduleNextRefresh() {
  clearRefreshTimer();
  updateAutoRefreshLabel();
  if (!state.autoRefresh || document.hidden || state.destroyed) return;
  state.timer = window.setTimeout(async () => {
    await refresh();
    scheduleNextRefresh();
  }, state.refreshInterval);
}

function bindRefreshControls() {
  const refreshButton = document.getElementById("refreshButton");
  const intervalSelect = document.getElementById("refreshInterval");
  const autoToggle = document.getElementById("autoRefreshToggle");

  refreshButton?.addEventListener("click", async () => {
    clearRefreshTimer();
    await refresh();
    scheduleNextRefresh();
  });

  intervalSelect?.addEventListener("change", () => {
    const interval = Number(intervalSelect.value);
    state.refreshInterval = REFRESH_INTERVALS.includes(interval)
      ? interval
      : DEFAULT_REFRESH_INTERVAL;
    scheduleNextRefresh();
  });

  autoToggle?.addEventListener("change", async () => {
    state.autoRefresh = autoToggle.checked;
    clearRefreshTimer();
    updateAutoRefreshLabel();
    if (state.autoRefresh) {
      await refresh();
      scheduleNextRefresh();
    }
  });

  document.addEventListener("visibilitychange", async () => {
    clearRefreshTimer();
    updateAutoRefreshLabel();
    if (!document.hidden && state.autoRefresh) {
      await refresh();
      scheduleNextRefresh();
    }
  });
}

function bindRangeControl() {
  document.querySelectorAll("#cpuRangeControl [data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      const range = Number(button.dataset.range);
      if (!Object.values(TIME_RANGES).includes(range)) return;
      state.rangeMs = range;
      document.querySelectorAll("#cpuRangeControl [data-range]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      renderCharts();
    });
  });
  setText("cpuThresholdLabel", `${THRESHOLDS.cpu.warning}%`);
}

function storedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (_) {
    return null;
  }
}

function applyTheme(theme, persist = false) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }

  const dark = theme === "dark";
  const themeIcon = document.getElementById("themeIcon");
  const themeButton = document.getElementById("themeButton");
  themeIcon?.setAttribute("href", `/static/icons.svg#${dark ? "sun" : "moon"}`);
  themeButton?.setAttribute("aria-label", dark ? "切换到浅色主题" : "切换到深色主题");
  themeButton?.setAttribute("title", dark ? "切换到浅色主题" : "切换到深色主题");
  window.requestAnimationFrame(() => charts.applyTheme());
}

function bindTheme() {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  document.getElementById("themeButton")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next, true);
  });

  media.addEventListener("change", (event) => {
    if (!storedTheme()) applyTheme(event.matches ? "dark" : "light");
  });
}

function destroy() {
  if (state.destroyed) return;
  state.destroyed = true;
  clearRefreshTimer();
  api.destroy();
  charts.destroy();
  processTable.destroy();
}

async function start() {
  bindTheme();
  bindRefreshControls();
  bindRangeControl();
  updateAutoRefreshLabel();
  renderAll();
  await refresh();
  scheduleNextRefresh();
}

window.addEventListener("pagehide", destroy, { once: true });
start();
