export function toFiniteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function parseByteValue(value) {
  const direct = toFiniteNumber(value);
  if (direct !== null) return Math.max(direct, 0);
  if (typeof value !== "string") return null;

  const match = value.trim().match(/^(-?[\d.]+)\s*(B|KB|MB|GB|TB)(?:\/s)?$/i);
  if (!match) return null;

  const number = Number(match[1]);
  if (!Number.isFinite(number) || number < 0) return null;
  const powers = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4 };
  return number * 1024 ** powers[match[2].toUpperCase()];
}

export function formatBytes(value, options = {}) {
  const number = toFiniteNumber(value);
  if (number === null || number < 0) return "--";

  const units = ["B", "KB", "MB", "GB", "TB"];
  if (number === 0) return "0 B";
  const unitIndex = Math.min(Math.floor(Math.log(number) / Math.log(1024)), units.length - 1);
  const scaled = number / 1024 ** unitIndex;
  const maximumFractionDigits =
    options.maximumFractionDigits ?? (scaled >= 100 || unitIndex === 0 ? 0 : scaled >= 10 ? 1 : 2);
  return `${scaled.toLocaleString("zh-CN", { maximumFractionDigits })} ${units[unitIndex]}`;
}

export function formatRate(value) {
  const formatted = formatBytes(value, { maximumFractionDigits: 1 });
  return formatted === "--" ? "--" : `${formatted}/s`;
}

export function formatPercent(value, includeUnit = true) {
  const number = toFiniteNumber(value);
  if (number === null) return "--";
  const output = Math.max(0, Math.min(number, 100)).toFixed(1);
  return includeUnit ? `${output}%` : output;
}

export function formatDuration(value) {
  const totalSeconds = toFiniteNumber(value);
  if (totalSeconds === null || totalSeconds < 0) return "--";

  let remaining = Math.floor(totalSeconds);
  const days = Math.floor(remaining / 86400);
  remaining %= 86400;
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  const minutes = Math.floor(remaining / 60);

  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
  if (minutes > 0) return `${minutes} 分钟`;
  return `${remaining} 秒`;
}

export function formatTimestamp(value, options = {}) {
  const number = toFiniteNumber(value);
  if (number === null || number <= 0) return "--";
  const milliseconds = number < 1e12 ? number * 1000 : number;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("zh-CN", {
    month: options.withDate === false ? undefined : "2-digit",
    day: options.withDate === false ? undefined : "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatChartTime(value, rangeMs) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    ...(rangeMs >= 60 * 60 * 1000 ? { hour: "2-digit", minute: "2-digit" } : {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    hour12: false,
  }).format(date);
}

export function severityFor(value, thresholds) {
  const number = toFiniteNumber(value);
  if (number === null) return "unknown";
  if (number >= thresholds.critical) return "critical";
  if (number >= thresholds.warning) return "warning";
  return "normal";
}

export function severityLabel(tone) {
  return {
    normal: "正常",
    warning: "需要关注",
    critical: "严重",
    unknown: "数据不足",
  }[tone] || "数据不足";
}

export function clampPercent(value) {
  const number = toFiniteNumber(value, 0);
  return Math.max(0, Math.min(number, 100));
}

export function average(values) {
  const valid = values.map((value) => toFiniteNumber(value)).filter((value) => value !== null);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? "--";
}

export function debounce(callback, wait = 150) {
  let timer = null;
  const debounced = (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), wait);
  };
  debounced.cancel = () => window.clearTimeout(timer);
  return debounced;
}

export function normalizeProcessStatus(value) {
  if (!value || value === "--") return "--";
  const normalized = String(value).toLowerCase();
  const labels = {
    running: "运行中",
    sleeping: "休眠",
    "disk-sleep": "磁盘等待",
    stopped: "已停止",
    tracing_stop: "跟踪停止",
    zombie: "僵尸",
    dead: "已结束",
    waking: "唤醒中",
    idle: "空闲",
    locked: "锁定",
    waiting: "等待",
  };
  return labels[normalized] || String(value);
}

export function errorMessage(error) {
  if (!error) return "未知错误";
  if (error.name === "AbortError") return "请求超时";
  return error.message || String(error);
}
