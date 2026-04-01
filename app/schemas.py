from pydantic import BaseModel, Field


class CpuInfo(BaseModel):
    logical_cores: int = Field(..., description="Number of logical CPU cores")
    physical_cores: int = Field(..., description="Number of physical CPU cores")
    cpu_percent: float = Field(..., ge=0, le=100, description="CPU usage percentage")


class MemoryInfo(BaseModel):
    total_bytes: int
    used_bytes: int
    available_bytes: int
    memory_percent: float = Field(..., ge=0, le=100)


class DiskInfo(BaseModel):
    device: str
    mountpoint: str
    filesystem: str
    total_bytes: int | None = None
    used_bytes: int | None = None
    usage_percent: float | None = Field(default=None, ge=0, le=100)
    error: str | None = None


class NetworkInfo(BaseModel):
    bytes_sent_total: int
    bytes_recv_total: int
    upload_bytes_per_sec: float
    download_bytes_per_sec: float


class ProcessInfo(BaseModel):
    pid: int | None = None
    name: str | None = None
    cpu_percent: float
    memory_percent: float
