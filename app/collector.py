"""System metrics collection helpers.

The original Chinese display fields are intentionally preserved for backwards
compatibility. New raw numeric fields are added so the dashboard can format
values consistently without parsing human-readable strings.
"""

from __future__ import annotations

import os
import platform
import socket
import threading
import time
from pathlib import Path
from typing import Any, Dict, List

import psutil


_network_lock = threading.Lock()
_last_network_sample: tuple[float, int, int] | None = None


def _host_mode_enabled() -> bool:
    return os.getenv("MONITOR_HOST_MODE", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def bytes_h(value: int | float) -> str:
    """Keep the legacy API representation in MB."""

    return f"{max(float(value), 0) / 1024 / 1024:.2f} MB"


def _safe_number(value: Any, default: float = 0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if number >= 0 else default


def _detect_environment() -> str:
    if _host_mode_enabled():
        return "Host"
    if os.getenv("KUBERNETES_SERVICE_HOST"):
        return "Kubernetes"
    if Path("/.dockerenv").exists():
        return "Docker"

    for cgroup_path in ("/proc/1/cgroup", "/proc/self/cgroup"):
        try:
            content = Path(cgroup_path).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if any(marker in content for marker in ("docker", "containerd", "kubepods")):
            return "Docker"

    return "Host"


def get_system() -> Dict[str, Any]:
    boot_time = _safe_number(psutil.boot_time())
    uptime_seconds = max(time.time() - boot_time, 0)

    try:
        load_average = [round(value, 2) for value in os.getloadavg()]
    except (AttributeError, OSError):
        load_average = []

    hostname = socket.gethostname()
    system_name = platform.system() or "Unknown"
    system_release = platform.release() or "Unknown"
    environment = _detect_environment()
    monitoring_scope = (
        "host" if _host_mode_enabled() or environment == "Host" else "container"
    )
    process_count = len(psutil.pids())

    return {
        "主机名": hostname,
        "操作系统": f"{system_name} {system_release}".strip(),
        "内核版本": system_release,
        "逻辑核心数": psutil.cpu_count(logical=True),
        "物理核心数": psutil.cpu_count(logical=False),
        "系统负载": load_average,
        "启动时间": boot_time,
        "运行时间": uptime_seconds,
        "Python版本": platform.python_version(),
        "运行环境": environment,
        "监控范围": "宿主机" if monitoring_scope == "host" else "容器",
        "进程数": process_count,
        "hostname": hostname,
        "os": system_name,
        "os_release": system_release,
        "kernel": system_release,
        "logical_cores": psutil.cpu_count(logical=True),
        "physical_cores": psutil.cpu_count(logical=False),
        "load_average": load_average,
        "boot_time": boot_time,
        "uptime_seconds": uptime_seconds,
        "python_version": platform.python_version(),
        "environment": environment,
        "monitoring_scope": monitoring_scope,
        "process_count": process_count,
    }


def get_cpu() -> Dict[str, Any]:
    logical_cores = psutil.cpu_count(logical=True)
    physical_cores = psutil.cpu_count(logical=False)
    percent = round(_safe_number(psutil.cpu_percent(interval=0.2)), 2)

    return {
        "逻辑核心数": logical_cores,
        "物理核心数": physical_cores,
        "CPU使用率": percent,
        "logical_cores": logical_cores,
        "physical_cores": physical_cores,
        "cpu_percent": percent,
        "percent": percent,
        "sample_time": time.time(),
    }


def get_memory() -> Dict[str, Any]:
    memory = psutil.virtual_memory()
    total = int(_safe_number(memory.total))
    used = int(_safe_number(memory.used))
    available = int(_safe_number(memory.available))
    cached = int(_safe_number(getattr(memory, "cached", 0)))
    buffers = int(_safe_number(getattr(memory, "buffers", 0)))
    percent = round(_safe_number(memory.percent), 2)

    return {
        "总计": bytes_h(total),
        "占用": bytes_h(used),
        "占用率": percent,
        "可用": bytes_h(available),
        "缓存": bytes_h(cached),
        "缓冲区": bytes_h(buffers),
        "total_bytes": total,
        "used_bytes": used,
        "available_bytes": available,
        "cached_bytes": cached,
        "buffers_bytes": buffers,
        "memory_percent": percent,
        "percent": percent,
        "sample_time": time.time(),
    }


def _disk_entry(
    device: str,
    mountpoint: str,
    filesystem: str,
    usage: Any,
) -> Dict[str, Any]:
    total = int(_safe_number(usage.total))
    used = int(_safe_number(usage.used))
    free = int(_safe_number(usage.free))
    percent = round(_safe_number(usage.percent), 2)

    return {
        "设备": device,
        "挂载点": mountpoint,
        "文件系统": filesystem,
        "总容量": bytes_h(total),
        "已使用": bytes_h(used),
        "可用": bytes_h(free),
        "使用率": percent,
        "device": device,
        "mountpoint": mountpoint,
        "filesystem": filesystem,
        "total_bytes": total,
        "used_bytes": used,
        "free_bytes": free,
        "usage_percent": percent,
        "percent": percent,
        "error": None,
    }


def get_disks() -> List[Dict[str, Any]]:
    disks: List[Dict[str, Any]] = []
    seen_mountpoints: set[str] = set()

    for partition in psutil.disk_partitions(all=False):
        mountpoint = partition.mountpoint
        if mountpoint in seen_mountpoints:
            continue
        # Read-only package images (for example Ubuntu Snap loop devices) are
        # always reported as 100% used. They are not writable capacity and
        # would otherwise produce a false critical disk alert.
        if partition.device.startswith("/dev/loop") or partition.fstype.lower() == "squashfs":
            continue
        # Docker commonly exposes /etc/hosts, /etc/hostname and resolv.conf as
        # file mounts. They all describe the same backing disk and are not
        # useful dashboard entries.
        if mountpoint != "/" and not os.path.isdir(mountpoint):
            continue

        seen_mountpoints.add(mountpoint)
        try:
            usage = psutil.disk_usage(mountpoint)
        except (PermissionError, OSError) as error:
            disks.append(
                {
                    "设备": partition.device,
                    "挂载点": mountpoint,
                    "文件系统": partition.fstype,
                    "错误": str(error) or "权限不足",
                    "device": partition.device,
                    "mountpoint": mountpoint,
                    "filesystem": partition.fstype,
                    "total_bytes": None,
                    "used_bytes": None,
                    "free_bytes": None,
                    "usage_percent": None,
                    "percent": None,
                    "error": str(error) or "Permission denied",
                }
            )
            continue

        disks.append(
            _disk_entry(
                partition.device,
                mountpoint,
                partition.fstype,
                usage,
            )
        )

    if "/" not in seen_mountpoints:
        try:
            disks.insert(0, _disk_entry("/", "/", "container", psutil.disk_usage("/")))
        except (PermissionError, OSError):
            pass

    return disks


def get_network(interval: float = 0) -> Dict[str, Any]:
    """Return cumulative counters and non-blocking rate estimates.

    ``interval`` is retained for call compatibility but intentionally ignored.
    The previous implementation slept for one second on every API request.
    Rates are now derived from consecutive calls under a lock.
    """

    del interval
    global _last_network_sample
    with _network_lock:
        counters = psutil.net_io_counters()
        now_monotonic = time.monotonic()
        bytes_sent = int(_safe_number(counters.bytes_sent))
        bytes_received = int(_safe_number(counters.bytes_recv))
        upload_rate = 0.0
        download_rate = 0.0
        previous = _last_network_sample
        if previous is not None:
            previous_time, previous_sent, previous_received = previous
            elapsed = now_monotonic - previous_time
            sent_delta = bytes_sent - previous_sent
            received_delta = bytes_received - previous_received
            if elapsed > 0 and sent_delta >= 0 and received_delta >= 0:
                upload_rate = sent_delta / elapsed
                download_rate = received_delta / elapsed
        _last_network_sample = (now_monotonic, bytes_sent, bytes_received)

    return {
        "上传": bytes_h(bytes_sent),
        "接收": bytes_h(bytes_received),
        "上传速度": f"{upload_rate / 1024 / 1024:.2f} MB/s",
        "下载速度": f"{download_rate / 1024 / 1024:.2f} MB/s",
        "bytes_sent_total": bytes_sent,
        "bytes_recv_total": bytes_received,
        "upload_bytes_per_sec": round(upload_rate, 2),
        "download_bytes_per_sec": round(download_rate, 2),
        "bytes_sent": bytes_sent,
        "bytes_recv": bytes_received,
        "upload_bytes_per_second": round(upload_rate, 2),
        "download_bytes_per_second": round(download_rate, 2),
        "sample_time": time.time(),
    }


def get_processes(limit: int = 200) -> List[Dict[str, Any]]:
    safe_limit = min(max(int(limit), 1), 1000)

    for process in psutil.process_iter():
        try:
            process.cpu_percent()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    time.sleep(0.2)
    now = time.time()
    processes: List[Dict[str, Any]] = []
    attributes = [
        "pid",
        "name",
        "cpu_percent",
        "memory_percent",
        "username",
        "status",
        "memory_info",
        "create_time",
    ]

    for process in psutil.process_iter(attributes):
        try:
            info = process.info
            pid = int(info.get("pid") or 0)
            name = info.get("name") or "未知进程"
            cpu_percent = round(_safe_number(info.get("cpu_percent")), 2)
            memory_percent = round(_safe_number(info.get("memory_percent")), 2)
            memory_info = info.get("memory_info")
            rss_bytes = int(_safe_number(getattr(memory_info, "rss", 0)))
            create_time = _safe_number(info.get("create_time"))
            runtime_seconds = max(now - create_time, 0) if create_time else 0
            username = info.get("username") or "--"
            status = info.get("status") or "--"
        except (psutil.NoSuchProcess, psutil.AccessDenied, ValueError):
            continue

        processes.append(
            {
                "进程ID": pid,
                "进程名": name,
                "CPU使用率": cpu_percent,
                "内存使用率": memory_percent,
                "用户": username,
                "状态": status,
                "RSS字节": rss_bytes,
                "启动时间": create_time,
                "运行时间": runtime_seconds,
                "pid": pid,
                "name": name,
                "cpu_percent": cpu_percent,
                "memory_percent": memory_percent,
                "username": username,
                "status": status,
                "rss_bytes": rss_bytes,
                "create_time": create_time,
                "runtime_seconds": runtime_seconds,
            }
        )

    processes.sort(
        key=lambda item: (item["CPU使用率"], item["内存使用率"]),
        reverse=True,
    )
    return processes[:safe_limit]


if __name__ == "__main__":
    import json

    output = {
        "系统信息": get_system(),
        "CPU信息": get_cpu(),
        "内存信息": get_memory(),
        "磁盘信息": get_disks(),
        "网络信息": get_network(),
        "进程列表": get_processes(10),
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
