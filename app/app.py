from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from . import collector

app = FastAPI()

# 挂载静态文件到 /static
app.mount("/static", StaticFiles(directory="static"), name="static")

# 首页返回 index.html
@app.get("/")
def index():
    return FileResponse("static/index.html")

@app.get("/api/cpu")
def cpu_info():
    return collector.get_cpu()

@app.get("/api/memory")
def memory_info():
    return collector.get_memory()

@app.get("/api/disks")
def disks_info():
    return collector.get_disks()

@app.get("/api/network")
def network_info():
    return collector.get_network()

@app.get("/api/processes")
def processes_info(limit: int = 10):
    return collector.get_processes(limit)
