FROM python:3.12-slim

# 设置工作目录
WORKDIR /app

# 先复制依赖清单，确保只修改源码时可以复用安装缓存
COPY requirements.txt ./requirements.txt

# 安装依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制项目文件
COPY app/ ./app/
COPY static/ ./static/

# 暴露端口
EXPOSE 1000

# 启动 FastAPI
CMD ["uvicorn", "app.app:app", "--host", "0.0.0.0", "--port", "1000"]
