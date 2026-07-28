# 轻量系统监控 Dashboard

面向个人服务器、开发环境和容器应用的轻量级实时监控面板。后端使用
FastAPI 与 psutil 采集数据，前端使用原生 HTML/CSS/JavaScript 和
Chart.js 展示趋势，不需要前端构建工具。

## 功能

- CPU 当前值、平均值、峰值、阈值参考线和最近 5 分钟至 1 小时趋势
- 内存与各挂载点磁盘的容量、可用空间和语义化阈值状态
- 网络上传/下载速率趋势与累计发送/接收字节
- 主机、系统、内核、核心数、负载、运行时间和运行环境摘要
- 进程 PID/名称搜索、CPU/内存/PID 排序、分页和只读详情
- 2/5/10/30 秒自动刷新、暂停、手动刷新和页面后台自动暂停
- 实时、数据延迟、断开与恢复状态，失败时保留最后一次有效数据
- 完整的明暗主题、系统主题跟随、响应式布局和键盘可访问性

## 项目结构

```text
monitor/
├── app/
│   ├── api/routes.py          # API 路由
│   ├── app.py                 # FastAPI 应用与静态资源挂载
│   ├── collector.py           # psutil 采集和兼容字段
│   └── schemas.py             # Pydantic 响应模型
├── static/
│   ├── js/
│   │   ├── adapters.js        # 新旧 API 字段适配
│   │   ├── api.js             # 请求与超时处理
│   │   ├── app.js             # 刷新、主题和页面生命周期
│   │   ├── charts.js          # Chart.js 公共配置
│   │   ├── components.js      # 指标、资源和进程组件
│   │   ├── config.js          # 阈值与刷新配置
│   │   ├── history.js         # 有限历史队列和网络速率计算
│   │   └── utils.js           # 格式化与状态工具
│   ├── icons.svg              # 本地图标精灵
│   ├── index.html             # 语义化页面结构
│   └── styles.css             # 响应式明暗主题
├── tests/                     # collector 与前端契约测试
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## API

目标仓库现有的 Pydantic 英文字段契约和原始版本中文字段均保持兼容，
API 路径没有改变：

- `GET /api/cpu`
- `GET /api/memory`
- `GET /api/disks`
- `GET /api/network`
- `GET /api/processes?limit=500`

为专业监控视图新增：

- `GET /api/system`：主机名、系统、内核、CPU 核心、负载、启动时间、
  运行时间、Python 版本、运行环境和进程总数

标准字段（如 `cpu_percent`、`memory_percent`、`usage_percent` 和
`bytes_sent_total`）继续通过 Pydantic 响应模型校验。接口同时追加
`free_bytes`、`cached_bytes`、`rss_bytes` 等监控详情，并保留旧的中文
显示字段，没有删除已有字段或改变其含义。

## 启动

### 本地开发

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.app:app --reload --host 0.0.0.0 --port 1000
```

访问 `http://127.0.0.1:1000`。

### Docker

默认 Compose 配置面向 Linux 宿主机监控，共享宿主机的 PID、网络和 UTS
命名空间。因此进程列表、网络吞吐和主机名来自宿主机，而不是只显示
Uvicorn 容器进程。

```bash
docker compose up -d --build
docker compose logs -f monitor
```

访问 `http://127.0.0.1:1000`。

## 验证

```bash
python -m unittest discover -s tests -v
python -m compileall -q app
```

也可以分别检查接口：

```bash
curl http://127.0.0.1:1000/api/system
curl http://127.0.0.1:1000/api/cpu
curl http://127.0.0.1:1000/api/memory
curl http://127.0.0.1:1000/api/disks
curl http://127.0.0.1:1000/api/network
curl "http://127.0.0.1:1000/api/processes?limit=20"
```

## 部署边界

默认 Docker 配置使用 `pid: host`、`network_mode: host` 和 `uts: host`，
仅适用于 Linux Docker Engine。它不会再通过 `ports` 映射端口，Uvicorn
会直接在宿主机 `1000` 端口监听。

共享宿主机命名空间会扩大容器的可见范围。Compose 同时启用了只读根文件
系统、丢弃 Linux capabilities、仅恢复监听 1000 端口所需的
`NET_BIND_SERVICE`，并启用 `no-new-privileges`。项目没有挂载宿主机根
目录，因此不能通过 Web 服务读取主机文件；磁盘容量表示 Docker 后端所在
文件系统，其他未挂载磁盘不会被枚举。

如果只想监控容器本身，应删除 `pid`、`network_mode`、`uts` 和
`MONITOR_HOST_MODE`，并恢复 `ports: ["1000:1000"]`。当前面板没有身份
认证，不应直接暴露在不可信公网。

Chart.js 延续原项目的 CDN 加载方式，未增加 npm 或 Python 依赖。离线环境
如需完整图表，可将同版本 Chart.js 文件放入 `static/` 并将页面引用改为
本地路径。
