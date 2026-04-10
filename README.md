# 团队动态负荷评估系统

一个可视化的团队负荷评估工具，支持多成员管理、能力与任务错配分析、成员级建议、团队级建议、快照记录与数据导出。

## 功能概览

- 多成员新增、切换、移除
- 5 个维度滑块评估（含权重与文字说明）
- Base TWI / CFC / Final TWI 计算
- 成员状态看板（健康 / 饱和 / 超负荷）
- 成员建议与团队建议自动生成
- 成员快照历史记录
- JSON 导出

## 技术栈

- HTML / CSS / JavaScript
- [Chart.js](https://www.chartjs.org/)（CDN）
- Nginx（Docker 静态托管）

## 本地运行

直接双击 `index.html` 即可打开，或使用任意静态服务器运行。

## Docker 运行

### 方式 1：Docker CLI

```bash
docker build -t team-workload-app:1.0.0 .
docker run -d --name team-workload-app -p 8080:80 team-workload-app:1.0.0
```

浏览器访问：`http://localhost:8080`

### 方式 2：Docker Compose

```bash
docker compose up -d --build
```

浏览器访问：`http://localhost:8080`

停止服务：

```bash
docker compose down
```

## Git 版本管理建议

### 1) 初始化仓库

```bash
git init
git branch -M main
```

### 2) 首次提交

```bash
git add .
git commit -m "feat: initial team workload assessment app with docker support"
```

### 3) 连接远程仓库（可选）

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

### 4) 建议分支策略

- `main`：稳定可发布
- `dev`：日常集成
- `feature/*`：功能开发
- `fix/*`：问题修复

### 5) 建议提交规范

- `feat:` 新功能
- `fix:` 修复
- `refactor:` 重构
- `docs:` 文档
- `chore:` 工程/脚手架调整

## 版本与变更记录

- 当前版本建议：`1.0.0`
- 变更记录文件：`CHANGELOG.md`

