#  系统监控仪表盘

一个基于 **FastAPI + psutil + Chart.js + Docker** 的轻量级系统监控仪表盘，支持实时查看：

- CPU 使用率  
- 内存占用情况  
- 网络上传/下载  
- 进程列表（排序 + 搜索）  
- 深色模式切换  
- 动态图表与数字显示  

界面美观、响应式布局、部署简单，适合作为课程项目、个人工具或系统监控面板。

---

##  功能概述

###  后端（FastAPI）
- 提供 `/api/cpu`、`/api/memory`、`/api/network`、`/api/processes` 等 REST API  
- 使用 `psutil` 采集系统资源  
- 模块化路由（APIRouter）  
- 静态文件托管（前端页面）  

###  前端（HTML + JS + Chart.js）
- CPU 折线图（平滑动画）  
- 内存饼图  
- 网络流量折线图  
- 实时数字显示（CPU%、内存 GB、网络 MB）  
- 进程列表（排序 + 搜索）  
- 深色模式切换  
- 卡片阴影、渐变主题、响应式布局  

###  Docker 容器化
- 一条命令即可启动  
- 自动安装依赖  
- 端口映射  
- 轻量、可部署  

---

##  项目结构
```
monitor/
├── app/
│    ├── app.py                            # FastAPI 主程序
│    ├── collector.py                # 系统信息采集逻辑（psutil）
│    ├── api/
│    │     └── routes.py          # API 路由
│    └── init.py
├── static/
│    └── index.html                    # 前端仪表盘页面
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
代码
```
---

##  运行方式

### 方式一：直接运行（开发模式）

```bash
pip install -r requirements.txt
uvicorn app.app:app --reload --port 1000
访问：
http://127.0.0.1:1000
```
### 方式二：Docker 运行（部署模式）
```bash
docker compose up -d
访问：
http://127.0.0.1:1000
```

##  核心技术点总结

### ✔ FastAPI
- 路由模块化  
- 静态文件挂载  
- JSON 自动序列化  
- FileResponse 返回 HTML  

### ✔ psutil 系统监控
- CPU：`cpu_percent()`、核心数  
- 内存：`virtual_memory()`  
- 网络：两次采样计算速度  
- 进程：`process_iter()` + 排序  

### ✔ Chart.js 前端可视化
- 折线图、饼图  
- 动态更新数据  
- 平滑动画  
- 自动滚动窗口  

### ✔ 前端交互
- 搜索过滤  
- 表格排序  
- 深色模式切换  
- 响应式布局  

### ✔ Docker
- 构建镜像  
- 运行容器  
- 处理容器内路径问题  
- 容器内进程隔离（PID namespace）  

---

##  界面展示

- CPU 折线图  
- 内存饼图  
- 网络流量图  
- 进程列表（排序 + 搜索）  
- 深色模式  
---

##  项目亮点

- 完整的前后端联动  
- 实时系统监控  
- UI 美观、交互友好  
- Docker 一键部署  
- 代码结构清晰、可扩展  
- 解决了多个真实开发问题（路径、字段、容器隔离等）  

---

## 未来可扩展方向

- GPU 监控  
- CPU 温度、频率  
- 磁盘 IO  
- WebSocket 实时推送  
- 用户登录认证  
- 多主机监控  

---

## 致谢

感谢所有参与本项目开发、调试、设计的成员。  
本项目作为课程作业，但实现了一个可用、可扩展的系统监控平台。
