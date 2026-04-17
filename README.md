# 团队动态负荷评估系统

面向 IT 运维与项目管理场景的团队负荷评估工具，支持成员档案维护、周任务量录入、历史趋势查看、全员看板与按组容量分析。

## 当前正式入口

- 前端主页：`public/index.v3.html`
- 前端脚本：`public/app.v3.new.js`
- 后端入口：`server.v2fixed.js`
- 数据库初始化：`init_db.js`

## 运行环境

- Node.js 22+
- npm 10+

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 初始化数据库

```bash
npm run init-db
```

3. 启动服务

```bash
npm start
```

4. 浏览器访问

```text
http://localhost:3000
```

## Docker 部署

项目已提供可直接使用的 `Dockerfile` 与 `docker-compose.yml`。

### 方式 1：Docker Compose

首次部署：

```bash
docker compose build --no-cache
docker compose up -d
```

查看状态：

```bash
docker compose ps
docker compose logs -f app
```

停止服务：

```bash
docker compose down
```

默认访问地址：

```text
http://<server-ip>:8080
```

### 方式 2：Docker CLI

构建镜像：

```bash
docker build -t team-workload:v1.3 .
```

启动容器：

```bash
docker run -d \
  --name team-workload-app \
  -p 8080:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DB_PATH=/app/data/team.db \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  team-workload:v1.3
```

## 数据持久化

- SQLite 数据库路径：`/app/data/team.db`
- Compose 已默认挂载宿主机 `./data` 到容器 `/app/data`
- 容器重启后数据会保留

## 发布与升级建议

### 内网服务器直接拉代码部署

```bash
git pull origin main
docker compose build --no-cache
docker compose up -d
```

### 使用内部镜像仓库部署

本地构建并推送：

```bash
docker build -t registry.company.local/team-workload:v1.3 .
docker push registry.company.local/team-workload:v1.3
```

服务器更新 `docker-compose.yml` 中的 `image` 后执行：

```bash
docker compose pull
docker compose up -d
```

## 注意事项

- `init_db.js` 现在只会在空库时写入演示数据，不会在每次容器重启时重复灌数
- 发布前建议备份 `data/team.db`
- 如需改端口，可调整 `docker-compose.yml` 中 `8080:3000` 的左侧宿主机端口
