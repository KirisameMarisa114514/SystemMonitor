from fastapi import APIRouter
from .. import collector

router = APIRouter()

@router.get("/cpu")
def cpu_info():
    return collector.get_cpu()

@router.get("/memory")
def memory_info():
    return collector.get_memory()

@router.get("/network")
def network_info():
    return collector.get_network()

@router.get("/disks")
def disks_info():
    return collector.get_disks()

@router.get("/processes")
def processes_info(limit: int = 10):
    return collector.get_processes(limit)
