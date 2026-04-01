from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import collector
from .schemas import CpuInfo, DiskInfo, MemoryInfo, NetworkInfo, ProcessInfo

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def index():
    return FileResponse("static/index.html")


@app.get("/api/cpu", response_model=CpuInfo)
def cpu_info():
    return collector.get_cpu()


@app.get("/api/memory", response_model=MemoryInfo)
def memory_info():
    return collector.get_memory()


@app.get("/api/disks", response_model=list[DiskInfo])
def disks_info():
    return collector.get_disks()


@app.get("/api/network", response_model=NetworkInfo)
def network_info():
    return collector.get_network()


@app.get("/api/processes", response_model=list[ProcessInfo])
def processes_info(limit: int = Query(default=10, ge=1, le=200)):
    return collector.get_processes(limit)
