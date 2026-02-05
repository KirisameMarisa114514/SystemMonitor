# collector.py - 极简系统信息采集脚本
import time
import psutil
import json
from typing import List, Dict, Any

def bytes_h(n: int) -> str:
    # 简单字节转 MB
    return f"{n/1024/1024:.2f} MB"

def get_cpu() -> Dict[str, Any]:
    return {
        "逻辑核心数": psutil.cpu_count(logical=True),
        "物理核心数": psutil.cpu_count(logical=False),
        "CPU使用率": psutil.cpu_percent(interval=0.2),
    }

def get_memory() -> Dict[str, Any]:
    v = psutil.virtual_memory()
    return {
        "总计": bytes_h(v.total),
        "占用": bytes_h(v.used),
        "占用率": v.percent,
        "可用": bytes_h(v.available)
    }

def get_disks() -> List[Dict[str, Any]]:
    parts = []
    for p in psutil.disk_partitions():
        try:
            u = psutil.disk_usage(p.mountpoint)
            parts.append({
                "设备": p.device,
                "挂载点": p.mountpoint,
                "文件系统": p.fstype,
                "总容量": bytes_h(u.total),
                "已使用": bytes_h(u.used),
                "使用率": u.percent
            })
        except PermissionError:
            parts.append({"设备": p.device, "挂载点": p.mountpoint, "错误": "权限不足"})
    return parts

def get_network(interval: float = 1.0) -> Dict[str, Any]:
    # 第一次采样
    io1 = psutil.net_io_counters()
    time.sleep(interval)
    # 第二次采样
    io2 = psutil.net_io_counters()
    
    # 计算速度（字节/秒）
    upload_speed = io2.bytes_sent - io1.bytes_sent
    download_speed = io2.bytes_recv - io1.bytes_recv
    
    return {
        "上传": bytes_h(io2.bytes_sent),
        "接收": bytes_h(io2.bytes_recv),
        "上传速度": f"{upload_speed/1024/1024:.2f} MB/s",
        "下载速度": f"{download_speed/1024/1024:.2f} MB/s"
    }


def get_processes(limit: int = 10) -> List[Dict[str, Any]]:
    # 第一次采样（全部为 0）
    for p in psutil.process_iter():
        p.cpu_percent()

    time.sleep(0.2)  # 等待 0.2 秒

    procs = []
    for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
        info = p.info
        procs.append({
            "进程ID": info.get("pid"),
            "进程名": info.get("name"),
            "CPU使用率": round(info.get("cpu_percent", 0), 2),
            "内存使用率": round(info.get("memory_percent", 0), 2)
        })

    # 按 CPU 使用率排序
    procs.sort(key=lambda x: x["CPU使用率"], reverse=True)

    return procs[:limit]


if __name__ == "__main__":
    out = {
        "CPU信息": get_cpu(),
        "内存信息": get_memory(),
        "磁盘信息": get_disks(),
        "网络信息": get_network(),
        "进程列表": get_processes(10)
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))
