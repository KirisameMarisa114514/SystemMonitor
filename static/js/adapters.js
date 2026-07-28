import { parseByteValue, toFiniteNumber } from "./utils.js";

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function numeric(...values) {
  return toFiniteNumber(firstDefined(...values));
}

export function normalizeSystem(raw = {}) {
  const systemName = firstDefined(raw.os, raw["操作系统"]);
  const release = firstDefined(raw.os_release);
  const osLabel =
    systemName && release && !String(systemName).includes(String(release))
      ? `${systemName} ${release}`
      : systemName;

  const loadValue = firstDefined(raw.load_average, raw["系统负载"]);
  const loadAverage = Array.isArray(loadValue)
    ? loadValue.map((value) => toFiniteNumber(value)).filter((value) => value !== null)
    : [];

  return {
    hostname: firstDefined(raw.hostname, raw["主机名"]),
    os: osLabel,
    kernel: firstDefined(raw.kernel, raw["内核版本"]),
    logicalCores: numeric(raw.logical_cores, raw["逻辑核心数"]),
    physicalCores: numeric(raw.physical_cores, raw["物理核心数"]),
    loadAverage,
    bootTime: numeric(raw.boot_time, raw["启动时间"]),
    uptimeSeconds: numeric(raw.uptime_seconds, raw["运行时间"]),
    pythonVersion: firstDefined(raw.python_version, raw["Python版本"]),
    environment: firstDefined(raw.environment, raw["运行环境"]),
    monitoringScope: firstDefined(raw.monitoring_scope, raw["监控范围"]),
    processCount: numeric(raw.process_count, raw["进程数"]),
  };
}

export function normalizeCpu(raw = {}) {
  return {
    percent: numeric(raw.cpu_percent, raw.percent, raw["CPU使用率"]),
    logicalCores: numeric(raw.logical_cores, raw["逻辑核心数"]),
    physicalCores: numeric(raw.physical_cores, raw["物理核心数"]),
    sampleTime: numeric(raw.sample_time) || Date.now() / 1000,
  };
}

export function normalizeMemory(raw = {}) {
  return {
    totalBytes: numeric(raw.total_bytes) ?? parseByteValue(raw["总计"]),
    usedBytes: numeric(raw.used_bytes) ?? parseByteValue(raw["占用"]),
    availableBytes: numeric(raw.available_bytes) ?? parseByteValue(raw["可用"]),
    cachedBytes: numeric(raw.cached_bytes) ?? parseByteValue(raw["缓存"]),
    buffersBytes: numeric(raw.buffers_bytes) ?? parseByteValue(raw["缓冲区"]),
    percent: numeric(raw.memory_percent, raw.percent, raw["占用率"]),
    sampleTime: numeric(raw.sample_time) || Date.now() / 1000,
  };
}

export function normalizeDisks(raw = []) {
  if (!Array.isArray(raw)) return [];
  return raw.map((disk) => ({
    device: firstDefined(disk.device, disk["设备"]),
    mountpoint: firstDefined(disk.mountpoint, disk["挂载点"]),
    filesystem: firstDefined(disk.filesystem, disk["文件系统"]),
    totalBytes: numeric(disk.total_bytes) ?? parseByteValue(disk["总容量"]),
    usedBytes: numeric(disk.used_bytes) ?? parseByteValue(disk["已使用"]),
    freeBytes: numeric(disk.free_bytes) ?? parseByteValue(disk["可用"]),
    percent: numeric(disk.usage_percent, disk.percent, disk["使用率"]),
    error: firstDefined(disk.error, disk["错误"]),
  }));
}

export function normalizeNetwork(raw = {}) {
  return {
    bytesSent:
      numeric(raw.bytes_sent_total, raw.bytes_sent) ?? parseByteValue(raw["上传"]),
    bytesReceived:
      numeric(raw.bytes_recv_total, raw.bytes_recv) ?? parseByteValue(raw["接收"]),
    uploadRate:
      numeric(raw.upload_bytes_per_sec, raw.upload_bytes_per_second) ??
      parseByteValue(raw["上传速度"]),
    downloadRate:
      numeric(raw.download_bytes_per_sec, raw.download_bytes_per_second) ??
      parseByteValue(raw["下载速度"]),
    sampleTime: numeric(raw.sample_time) || Date.now() / 1000,
  };
}

export function normalizeProcesses(raw = []) {
  if (!Array.isArray(raw)) return [];
  return raw.map((process) => ({
    pid: numeric(process.pid, process["进程ID"]),
    name: firstDefined(process.name, process["进程名"]) || "未知进程",
    username: firstDefined(process.username, process["用户"]) || "--",
    status: firstDefined(process.status, process["状态"]) || "--",
    cpu: numeric(process.cpu_percent, process["CPU使用率"]) ?? 0,
    memory: numeric(process.memory_percent, process["内存使用率"]) ?? 0,
    rssBytes: numeric(process.rss_bytes, process["RSS字节"]),
    createTime: numeric(process.create_time, process["启动时间"]),
    runtimeSeconds: numeric(process.runtime_seconds, process["运行时间"]),
  }));
}

export const ADAPTERS = Object.freeze({
  system: normalizeSystem,
  cpu: normalizeCpu,
  memory: normalizeMemory,
  disks: normalizeDisks,
  network: normalizeNetwork,
  processes: normalizeProcesses,
});
