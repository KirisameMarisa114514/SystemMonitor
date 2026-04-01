import time
from typing import Any

import psutil


def get_cpu() -> dict[str, Any]:
    return {
        "logical_cores": psutil.cpu_count(logical=True),
        "physical_cores": psutil.cpu_count(logical=False),
        "cpu_percent": psutil.cpu_percent(interval=0.2),
    }


def get_memory() -> dict[str, Any]:
    v = psutil.virtual_memory()
    return {
        "total_bytes": v.total,
        "used_bytes": v.used,
        "available_bytes": v.available,
        "memory_percent": v.percent,
    }


def get_disks() -> list[dict[str, Any]]:
    parts = []
    for p in psutil.disk_partitions():
        try:
            u = psutil.disk_usage(p.mountpoint)
            parts.append(
                {
                    "device": p.device,
                    "mountpoint": p.mountpoint,
                    "filesystem": p.fstype,
                    "total_bytes": u.total,
                    "used_bytes": u.used,
                    "usage_percent": u.percent,
                    "error": None,
                }
            )
        except PermissionError:
            parts.append(
                {
                    "device": p.device,
                    "mountpoint": p.mountpoint,
                    "filesystem": p.fstype,
                    "total_bytes": None,
                    "used_bytes": None,
                    "usage_percent": None,
                    "error": "permission_denied",
                }
            )
    return parts


def get_network(interval: float = 1.0) -> dict[str, Any]:
    io1 = psutil.net_io_counters()
    time.sleep(interval)
    io2 = psutil.net_io_counters()

    upload_speed = (io2.bytes_sent - io1.bytes_sent) / interval
    download_speed = (io2.bytes_recv - io1.bytes_recv) / interval

    return {
        "bytes_sent_total": io2.bytes_sent,
        "bytes_recv_total": io2.bytes_recv,
        "upload_bytes_per_sec": round(upload_speed, 2),
        "download_bytes_per_sec": round(download_speed, 2),
    }


def get_processes(limit: int = 10) -> list[dict[str, Any]]:
    for p in psutil.process_iter():
        p.cpu_percent()

    time.sleep(0.2)

    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
        info = p.info
        procs.append(
            {
                "pid": info.get("pid"),
                "name": info.get("name"),
                "cpu_percent": round(info.get("cpu_percent", 0), 2),
                "memory_percent": round(info.get("memory_percent", 0), 2),
            }
        )

    procs.sort(key=lambda x: x["cpu_percent"], reverse=True)

    return procs[:limit]
