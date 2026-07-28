from fastapi import APIRouter, Query

from .. import collector
from ..schemas import (
    CpuInfo,
    DiskInfo,
    MemoryInfo,
    NetworkInfo,
    ProcessInfo,
    SystemInfo,
)


router = APIRouter()


@router.get("/system", response_model=SystemInfo)
def system_info():
    return collector.get_system()


@router.get("/cpu", response_model=CpuInfo)
def cpu_info():
    return collector.get_cpu()


@router.get("/memory", response_model=MemoryInfo)
def memory_info():
    return collector.get_memory()


@router.get("/network", response_model=NetworkInfo)
def network_info():
    return collector.get_network()


@router.get("/disks", response_model=list[DiskInfo])
def disks_info():
    return collector.get_disks()


@router.get("/processes", response_model=list[ProcessInfo])
def processes_info(
    limit: int = Query(default=10, ge=1, le=200),
):
    return collector.get_processes(limit)
