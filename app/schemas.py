from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    """Validate canonical fields while retaining legacy compatibility keys."""

    model_config = ConfigDict(extra="allow")


class SystemInfo(ApiModel):
    hostname: str
    os: str
    os_release: str
    kernel: str
    logical_cores: int | None = None
    physical_cores: int | None = None
    load_average: list[float] = Field(default_factory=list)
    boot_time: float
    uptime_seconds: float
    python_version: str
    environment: str
    monitoring_scope: str
    process_count: int


class CpuInfo(ApiModel):
    logical_cores: int | None = Field(
        default=None,
        description="Number of logical CPU cores",
    )
    physical_cores: int | None = Field(
        default=None,
        description="Number of physical CPU cores",
    )
    cpu_percent: float = Field(
        ...,
        ge=0,
        le=100,
        description="CPU usage percentage",
    )


class MemoryInfo(ApiModel):
    total_bytes: int
    used_bytes: int
    available_bytes: int
    memory_percent: float = Field(..., ge=0, le=100)
    cached_bytes: int = 0
    buffers_bytes: int = 0


class DiskInfo(ApiModel):
    device: str
    mountpoint: str
    filesystem: str
    total_bytes: int | None = None
    used_bytes: int | None = None
    free_bytes: int | None = None
    usage_percent: float | None = Field(default=None, ge=0, le=100)
    error: str | None = None


class NetworkInfo(ApiModel):
    bytes_sent_total: int
    bytes_recv_total: int
    upload_bytes_per_sec: float
    download_bytes_per_sec: float


class ProcessInfo(ApiModel):
    pid: int | None = None
    name: str | None = None
    cpu_percent: float
    memory_percent: float
    username: str | None = None
    status: str | None = None
    rss_bytes: int | None = None
    create_time: float | None = None
    runtime_seconds: float | None = None
