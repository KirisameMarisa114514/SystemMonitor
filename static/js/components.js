import { THRESHOLDS } from "./config.js";
import {
  clampPercent,
  debounce,
  errorMessage,
  formatBytes,
  formatDuration,
  formatPercent,
  formatRate,
  formatTimestamp,
  normalizeProcessStatus,
  setText,
  severityFor,
  severityLabel,
} from "./utils.js";

function setMetric(id, value, note, tone = "unknown") {
  const card = document.getElementById(`${id}Metric`);
  if (card) card.dataset.tone = tone;
  setText(`${id}MetricValue`, value);
  setText(`${id}MetricNote`, note);
  const unit = card?.querySelector(".metric-card__value small");
  if (unit) unit.hidden = value === "--";
}

function worstTone(tones) {
  if (tones.includes("critical")) return "critical";
  if (tones.includes("warning")) return "warning";
  if (tones.length && tones.every((tone) => tone === "normal")) return "normal";
  return "unknown";
}

function primaryDisk(disks) {
  const valid = disks.filter((disk) => !disk.error && disk.percent !== null);
  return valid.find((disk) => disk.mountpoint === "/") || valid[0] || null;
}

function highestDisk(disks) {
  return disks
    .filter((disk) => !disk.error && disk.percent !== null)
    .sort((a, b) => b.percent - a.percent)[0] || null;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export class DashboardRenderer {
  render(snapshot, currentNetwork) {
    this.renderMetrics(snapshot, currentNetwork);
    this.renderSummary(snapshot.system);
    this.renderResources(snapshot.memory, snapshot.disks || []);
    this.renderNetwork(snapshot.network, currentNetwork);
  }

  renderMetrics(snapshot, currentNetwork) {
    const cpuTone = severityFor(snapshot.cpu?.percent, THRESHOLDS.cpu);
    const memoryTone = severityFor(snapshot.memory?.percent, THRESHOLDS.memory);
    const fullestDisk = highestDisk(snapshot.disks || []);
    const diskTone = severityFor(fullestDisk?.percent, THRESHOLDS.disk);
    const healthTone = worstTone([cpuTone, memoryTone, diskTone]);

    const healthLabels = {
      normal: ["运行正常", "CPU、内存与磁盘均低于警告阈值"],
      warning: ["需要关注", "至少一项资源已达到警告阈值"],
      critical: ["资源告警", "至少一项资源已达到严重阈值"],
      unknown: ["数据不足", "等待 CPU、内存与磁盘数据"],
    };
    const [healthValue, healthNote] = healthLabels[healthTone];
    setMetric("health", healthValue, healthNote, healthTone);

    setMetric(
      "cpu",
      formatPercent(snapshot.cpu?.percent, false),
      snapshot.cpu?.logicalCores
        ? `${snapshot.cpu.logicalCores} 个逻辑核心 · ${severityLabel(cpuTone)}`
        : severityLabel(cpuTone),
      cpuTone,
    );

    setMetric(
      "memory",
      formatPercent(snapshot.memory?.percent, false),
      snapshot.memory
        ? `${formatBytes(snapshot.memory.usedBytes)} / ${formatBytes(snapshot.memory.totalBytes)}`
        : "等待采样",
      memoryTone,
    );

    // The metric card represents the fullest writable mount so a secondary
    // volume cannot be critical while the headline card still looks normal.
    const metricDisk = fullestDisk || primaryDisk(snapshot.disks || []);
    setMetric(
      "disk",
      formatPercent(metricDisk?.percent, false),
      metricDisk
        ? `${metricDisk.mountpoint || "--"} · 可用 ${formatBytes(metricDisk.freeBytes)}`
        : "未获取到可用磁盘",
      severityFor(metricDisk?.percent, THRESHOLDS.disk),
    );

    setMetric(
      "network",
      formatRate(currentNetwork?.downloadRate),
      currentNetwork
        ? `上传 ${formatRate(currentNetwork.uploadRate)}`
        : "等待网络采样",
      "normal",
    );

    setMetric(
      "uptime",
      formatDuration(snapshot.system?.uptimeSeconds),
      snapshot.system?.bootTime
        ? `启动于 ${formatTimestamp(snapshot.system.bootTime)}`
        : "启动时间 --",
      "normal",
    );
  }

  renderSummary(system) {
    setText("targetName", system?.hostname || "本地主机");
    setText("environmentBadge", system?.environment || "--");
    setText("summaryHostname", system?.hostname || "--");
    setText("summaryOs", system?.os || "--");
    setText("summaryKernel", system?.kernel || "--");

    let cores = "--";
    if (system?.logicalCores !== null && system?.logicalCores !== undefined) {
      cores = `${system.logicalCores} 逻辑`;
      if (system.physicalCores) cores += ` / ${system.physicalCores} 物理`;
    }
    setText("summaryCores", cores);
    setText(
      "summaryLoad",
      system?.loadAverage?.length
        ? system.loadAverage.map((value) => Number(value).toFixed(2)).join(" / ")
        : "--",
    );
    setText("summaryProcesses", system?.processCount ?? "--");
    setText("summaryPython", system?.pythonVersion || "--");
    setText("summaryEnvironment", system?.environment || "--");
  }

  renderResources(memory, disks) {
    const memoryTone = severityFor(memory?.percent, THRESHOLDS.memory);
    const memoryProgress = document.getElementById("memoryProgress");
    if (memoryProgress) {
      memoryProgress.value = clampPercent(memory?.percent);
      memoryProgress.dataset.tone = memoryTone;
      memoryProgress.setAttribute("aria-valuetext", formatPercent(memory?.percent));
    }
    setText("memoryResourcePercent", formatPercent(memory?.percent));
    setText("memoryUsed", formatBytes(memory?.usedBytes));
    setText("memoryAvailable", formatBytes(memory?.availableBytes));
    setText("memoryTotal", formatBytes(memory?.totalBytes));

    const cacheParts = [];
    if (memory?.cachedBytes) cacheParts.push(formatBytes(memory.cachedBytes));
    if (memory?.buffersBytes) cacheParts.push(formatBytes(memory.buffersBytes));
    setText("memoryCache", cacheParts.length ? cacheParts.join(" / ") : "--");

    const list = document.getElementById("diskList");
    if (!list) return;
    list.replaceChildren();
    setText("diskCount", disks.length ? `${disks.length} 个挂载点` : "无数据");

    if (!disks.length) {
      list.append(createElement("div", "inline-empty", "未获取到磁盘数据"));
      return;
    }

    disks.forEach((disk) => {
      const item = createElement("div", "disk-item");
      if (disk.error) {
        item.append(createElement("div", "inline-empty", `${disk.mountpoint || "磁盘"}：${disk.error}`));
        list.append(item);
        return;
      }

      const meta = createElement("div", "disk-item__meta");
      meta.append(
        createElement("span", "disk-item__mount", disk.mountpoint || "--"),
        createElement("span", "", formatPercent(disk.percent)),
      );

      const progress = createElement("progress");
      progress.max = 100;
      progress.value = clampPercent(disk.percent);
      progress.dataset.tone = severityFor(disk.percent, THRESHOLDS.disk);
      progress.setAttribute("aria-label", `${disk.mountpoint || "磁盘"}使用率`);
      progress.setAttribute("aria-valuetext", formatPercent(disk.percent));

      const values = createElement("div", "disk-item__values");
      values.append(
        createElement("span", "", `已用 ${formatBytes(disk.usedBytes)}`),
        createElement("span", "", `可用 ${formatBytes(disk.freeBytes)}`),
        createElement("span", "", `总量 ${formatBytes(disk.totalBytes)}`),
      );
      item.append(meta, progress, values);
      list.append(item);
    });
  }

  renderNetwork(network, currentNetwork) {
    setText("uploadRate", formatRate(currentNetwork?.uploadRate));
    setText("downloadRate", formatRate(currentNetwork?.downloadRate));
    setText("totalSent", formatBytes(network?.bytesSent));
    setText("totalReceived", formatBytes(network?.bytesReceived));
  }

  renderCpuStats(stats) {
    setText("cpuCurrent", formatPercent(stats.current));
    setText("cpuAverage", formatPercent(stats.average));
    setText("cpuPeak", formatPercent(stats.peak));
    setText("cpuSamples", String(stats.count));
  }
}

export class ProcessTable {
  constructor() {
    this.data = [];
    this.totalAvailable = null;
    this.query = "";
    this.sortKey = "cpu";
    this.sortDirection = "desc";
    this.page = 1;
    this.pageSize = 10;
    this.loading = true;
    this.error = null;

    this.body = document.getElementById("processTableBody");
    this.search = document.getElementById("processSearch");
    this.pageSizeSelect = document.getElementById("pageSize");
    this.previousButton = document.getElementById("previousPage");
    this.nextButton = document.getElementById("nextPage");
    this.dialog = document.getElementById("processDialog");
    this.detail = document.getElementById("processDetail");
    this.closeDialogButton = document.getElementById("closeProcessDialog");
    this.errorBanner = document.getElementById("processError");

    this.onSearch = debounce((event) => {
      this.query = event.target.value.trim().toLocaleLowerCase("zh-CN");
      this.page = 1;
      this.render();
    });
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    this.search?.addEventListener("input", this.onSearch);
    this.pageSizeSelect?.addEventListener("change", () => {
      this.pageSize = Number(this.pageSizeSelect.value) || 10;
      this.page = 1;
      this.render();
    });
    document.querySelectorAll("[data-sort]").forEach((button) => {
      button.addEventListener("click", () => this.toggleSort(button.dataset.sort));
    });
    this.previousButton?.addEventListener("click", () => {
      this.page = Math.max(1, this.page - 1);
      this.render();
    });
    this.nextButton?.addEventListener("click", () => {
      this.page += 1;
      this.render();
    });
    this.closeDialogButton?.addEventListener("click", () => this.dialog?.close());
    this.dialog?.addEventListener("click", (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });
  }

  toggleSort(key) {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortKey = key;
      this.sortDirection = key === "name" || key === "pid" ? "asc" : "desc";
    }
    this.page = 1;
    this.render();
  }

  setLoading() {
    this.loading = true;
    if (!this.data.length) this.render();
  }

  setData(data, totalAvailable) {
    this.data = Array.isArray(data) ? data : [];
    this.totalAvailable = totalAvailable;
    this.loading = false;
    this.error = null;
    this.render();
  }

  setError(error) {
    this.loading = false;
    this.error = errorMessage(error);
    this.render();
  }

  filteredAndSorted() {
    const filtered = this.data.filter((process) => {
      if (!this.query) return true;
      return (
        String(process.pid ?? "").includes(this.query) ||
        String(process.name ?? "").toLocaleLowerCase("zh-CN").includes(this.query)
      );
    });

    const direction = this.sortDirection === "asc" ? 1 : -1;
    filtered.sort((left, right) => {
      if (this.sortKey === "name") {
        return String(left.name).localeCompare(String(right.name), "zh-CN") * direction;
      }
      const keys = { pid: "pid", cpu: "cpu", memory: "memory" };
      return ((left[keys[this.sortKey]] ?? 0) - (right[keys[this.sortKey]] ?? 0)) * direction;
    });
    return filtered;
  }

  render() {
    if (!this.body) return;
    this.updateSortState();
    this.updateErrorBanner();

    if (this.loading && !this.data.length) {
      this.renderState("正在加载进程数据", "loading");
      this.updateFooter(0, 1, 1);
      return;
    }
    if (this.error && !this.data.length) {
      this.renderState(`进程数据加载失败：${this.error}`, "error");
      this.updateFooter(0, 1, 1);
      return;
    }

    const filtered = this.filteredAndSorted();
    const pageCount = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    this.page = Math.min(this.page, pageCount);
    const start = (this.page - 1) * this.pageSize;
    const pageItems = filtered.slice(start, start + this.pageSize);
    this.body.replaceChildren();

    if (!pageItems.length) {
      const message = this.query ? "没有符合搜索条件的进程" : "当前没有可显示的进程";
      this.renderState(message, "empty");
    } else {
      pageItems.forEach((process) => this.body.append(this.createRow(process)));
    }
    this.updateFooter(filtered.length, pageCount, this.page);
  }

  renderState(message, type) {
    this.body.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    const state = createElement(
      "div",
      `table-state${type === "error" ? " table-state--error" : ""}`,
      message,
    );
    if (type === "loading") state.setAttribute("aria-busy", "true");
    cell.append(state);
    row.append(cell);
    this.body.append(row);
  }

  createRow(process) {
    const row = document.createElement("tr");
    row.append(createElement("td", "", process.pid ?? "--"));

    const nameCell = document.createElement("td");
    const nameButton = createElement("button", "process-link", process.name || "未知进程");
    nameButton.type = "button";
    nameButton.title = `查看 ${process.name || "进程"} 详情`;
    nameButton.addEventListener("click", () => this.openDetail(process));
    nameCell.append(nameButton);
    row.append(nameCell);

    row.append(createElement("td", "", process.username || "--"));
    const statusCell = document.createElement("td");
    const status = createElement("span", "status-badge", normalizeProcessStatus(process.status));
    status.dataset.status = String(process.status || "").toLowerCase();
    statusCell.append(status);
    row.append(statusCell);
    row.append(
      createElement("td", "", formatPercent(process.cpu)),
      createElement("td", "", formatPercent(process.memory)),
      createElement("td", "", formatBytes(process.rssBytes)),
      createElement("td", "", formatDuration(process.runtimeSeconds)),
    );
    return row;
  }

  updateSortState() {
    document.querySelectorAll("[data-sort-column]").forEach((header) => {
      const active = header.dataset.sortColumn === this.sortKey;
      if (active) {
        header.setAttribute("aria-sort", this.sortDirection === "asc" ? "ascending" : "descending");
      } else {
        header.removeAttribute("aria-sort");
      }
    });
  }

  updateErrorBanner() {
    if (!this.errorBanner) return;
    if (this.error && this.data.length) {
      this.errorBanner.hidden = false;
      this.errorBanner.textContent = `刷新失败，正在保留上一次有效进程数据：${this.error}`;
    } else {
      this.errorBanner.hidden = true;
      this.errorBanner.textContent = "";
    }
  }

  updateFooter(filteredCount, pageCount, currentPage) {
    const count = document.getElementById("processResultCount");
    if (count) {
      const sampleText = `共 ${filteredCount} 条结果`;
      const totalText =
        this.totalAvailable && this.totalAvailable > this.data.length
          ? ` · 已采样 ${this.data.length} / 系统 ${this.totalAvailable}`
          : "";
      count.textContent = sampleText + totalText;
    }
    setText("pageIndicator", `第 ${currentPage} / ${pageCount} 页`);
    if (this.previousButton) this.previousButton.disabled = currentPage <= 1;
    if (this.nextButton) this.nextButton.disabled = currentPage >= pageCount;
  }

  openDetail(process) {
    if (!this.dialog || !this.detail) return;
    setText("processDialogTitle", process.name || "进程详情");
    const details = [
      ["PID", process.pid ?? "--"],
      ["名称", process.name || "--"],
      ["用户", process.username || "--"],
      ["状态", normalizeProcessStatus(process.status)],
      ["CPU 使用率", formatPercent(process.cpu)],
      ["内存使用率", formatPercent(process.memory)],
      ["RSS 内存", formatBytes(process.rssBytes)],
      ["启动时间", formatTimestamp(process.createTime)],
      ["运行时间", formatDuration(process.runtimeSeconds)],
    ];
    this.detail.replaceChildren();
    details.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.append(createElement("dt", "", label), createElement("dd", "", value));
      this.detail.append(item);
    });
    if (!this.dialog.open) this.dialog.showModal();
  }

  destroy() {
    this.onSearch.cancel();
    this.search?.removeEventListener("input", this.onSearch);
    this.dialog?.close();
  }
}

export function showToast(message, tone = "info", duration = 3600) {
  const region = document.getElementById("toastRegion");
  if (!region) return;
  const toast = createElement("div", "toast", message);
  toast.dataset.tone = tone;
  region.append(toast);
  window.setTimeout(() => toast.remove(), duration);
}
