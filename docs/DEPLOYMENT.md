# v2.0.0 部署、升级和回滚

以下生产命令适用于 Linux Docker 主机，使用 Docker Compose v2。默认目录挂载仍为 `./data:/app/data`，数据库仍为 `team.db`。**必须在原部署目录操作，避免相对路径变化导致打开空库。** 如旧部署使用其他目录、端口、项目名或数据库文件，请保留对应配置。

## 1. 升级前确认

- 版本：Git 标签 `v2.0.0`，镜像 `team-workload:2.0.0`。
- 支持直接迁移仓库 v1.3 的 SQLite 数据。启动会自动迁移，不能让新旧应用同时写同一个库。
- 原团队 INFR 保留；其他旧团队的成员标为待分配，由管理员分配至 INFR / ADI / SMO / TO。历史团队不改写。
- 生产环境新要求 `ADMIN_PASSWORD` ≥12 字符；保存于服务器 `.env`，不要提交 Git 或放入离线包。
- 新版进程使用 UID/GID 1000；旧版 root 创建的数据目录需调整权限。
- 如有 HTTPS 代理，保留外部 Host；设置 `COOKIE_SECURE=true`。应用不捆绑 TLS 证书。

## 2. 联网构建机制作离线包

在可联网、装有 Docker 的机器执行。先确认目标服务器架构：`uname -m`。下面以常见 Linux amd64 为例；ARM64 主机改为 `linux/arm64`。

```bash
git clone https://github.com/shenjian0709-cloud/team-workload-calculator.git
cd team-workload-calculator
git checkout v2.0.0
docker build --platform linux/amd64 -t team-workload:2.0.0 .

# 构建后在同架构环境完成测试，再导出
docker run --rm --entrypoint node team-workload:2.0.0 --version
docker save -o team-workload-2.0.0-linux-amd64.tar team-workload:2.0.0
sha256sum team-workload-2.0.0-linux-amd64.tar > SHA256SUMS
```

Windows PowerShell 构建机可使用相同 Docker 命令；校验可运行：

```powershell
Get-FileHash .\team-workload-2.0.0-linux-amd64.tar -Algorithm SHA256
```

通过批准的文件传输方式，将以下文件送至内网服务器：

- `team-workload-2.0.0-linux-amd64.tar`
- `SHA256SUMS`（或单独记录的 SHA256）
- `compose.offline.yml`
- `.env.example`
- 本升级文档

离线服务器无需 Node、npm、GitHub 或 CDN 访问；镜像已包含运行依赖。不要将开发用 `data/` 或 `.env` 打包进去。

## 3. 服务器停机备份（两种升级路径都需要）

先将离线包放在**独立暂存目录**（例如 `/tmp/team-capacity-2.0.0`），不要提前覆盖旧 Compose。
进入现有部署目录，运行：

```bash
backup_dir="$(pwd)/backups/pre-v2-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

# 记录原镜像，并为其保留一个明确的回滚标签
docker inspect team-workload-app > "$backup_dir/container-inspect.json"
old_image=$(docker inspect --format '{{.Image}}' team-workload-app)
docker image tag "$old_image" team-workload:pre-v2
docker save -o "$backup_dir/previous-image.tar" team-workload:pre-v2
cp docker-compose.yml "$backup_dir/docker-compose.yml"
if [ -f .env ]; then cp .env "$backup_dir/.env"; fi

docker stop team-workload-app
# 停止所有写入后备份整个目录，包含可能存在的 WAL/SHM 文件
tar -czpf "$backup_dir/data.tar.gz" data
tar -tzf "$backup_dir/data.tar.gz"
printf '备份目录：%s\n' "$backup_dir"
```

记住这个备份目录。`container-inspect.json` 可能含旧环境变量，仅管理员可访问。
若容器名称不同，请替换为实际容器名。若使用命名卷，需先按该卷实际配置备份，不能直接使用以上 `tar data`。

## 4A. 离线服务器升级

仍在原部署目录执行，先验证传入文件：

```bash
(cd /tmp/team-capacity-2.0.0 && sha256sum -c SHA256SUMS)
docker load -i /tmp/team-capacity-2.0.0/team-workload-2.0.0-linux-amd64.tar
cp /tmp/team-capacity-2.0.0/compose.offline.yml ./docker-compose.yml

# 如尚无 .env，先复制示例；已有文件请合并下面的配置
if [ ! -f .env ]; then cp /tmp/team-capacity-2.0.0/.env.example .env; fi
chmod 600 .env
```

用编辑器设置 `.env`：

```dotenv
ADMIN_PASSWORD=请替换为至少12字符的独立访问密码
APP_PORT=8080
COOKIE_SECURE=false
```

然后修复旧数据权限并启动：

```bash
sudo chown -R 1000:1000 ./data
docker compose up -d --no-build --pull never --wait --wait-timeout 90
docker compose ps
docker compose logs --tail=100 app
curl --fail http://127.0.0.1:8080/healthz
```

健康接口应返回 `{"status":"ok","version":"2.0.0"}`。启动迁移自动完成，不用重复运行旧版 `init_db.js`。
若旧容器由 `docker run` 创建而不是 Compose 管理，保留已停止的容器并改名（例如 `docker rename team-workload-app team-workload-app-pre-v2`），再启动 Compose，避免名称冲突。

## 4B. 可联网服务器直接更新代码

完成第 3 节备份后，在原 Git 部署目录执行：

```bash
git status --short
# 先保留并检查服务器本地定制配置，不要强制覆盖本地变更
git fetch origin --tags
git checkout v2.0.0
# 按第 4A 节配置 .env 并确认端口、挂载目录
sudo chown -R 1000:1000 ./data
docker compose build --pull
docker compose up -d --wait --wait-timeout 90
curl --fail http://127.0.0.1:8080/healthz
```

固定发布标签比直接 `git pull main` 更便于复现版本。

## 5. 上线验收

1. 使用新访问密码登录，确认版本为 2.0.0。
2. 核对旧成员数量、姓名及历史周记录；“待分配”不代表成员丢失。
3. 在成员管理中完成旧团队归属调整。
4. 本周未填报成员显示“未填报”；没有自动把旧任务量冒充本周数据。
5. 选择一个测试成员填报，刷新后确认数值保留；历史快照应保留其原模型分数。
6. 验证新增、修改、删除后归档及恢复；确认切换统计周和小组正常。
7. 容器重启后再次核对数据：`docker compose restart`。

不要把 JSON 导出当作数据库可恢复备份。原版无周号任务量、异常周号快照保留于原 SQLite 表；需要查阅时使用数据库备份副本。

## 6. 回滚

回滚会恢复至升级前的数据时间点。先停止新版并另存当前数据，避免丢失升级后录入。
将 `backup_dir` 设置成第 3 节的实际备份目录：

```bash
docker compose down
failed_dir="data-v2-preserved-$(date +%Y%m%d-%H%M%S)"
mv data "$failed_dir"
tar -xzpf "$backup_dir/data.tar.gz"
docker load -i "$backup_dir/previous-image.tar"
cp "$backup_dir/docker-compose.yml" docker-compose.yml
if [ -f "$backup_dir/.env" ]; then cp "$backup_dir/.env" .env; fi
```

旧 Compose 的 `image` 可能仍是 `team-workload:v1.3`。创建明确的覆盖文件，用已保存的旧镜像启动，不重新构建：

```bash
cat > compose.rollback.yml <<'EOF'
services:
  app:
    image: team-workload:pre-v2
EOF
docker compose -f docker-compose.yml -f compose.rollback.yml up -d --no-build --pull never
docker compose logs --tail=100 app
```

若原来是 `docker run` 部署，应恢复备份数据后启动之前保留的旧容器。
旧版不认识新版 `weekly_reports`，所以仅回退镜像而不恢复升级前数据库，不构成完整回滚。

## 7. 日常运维

- 定期停机备份整个 `data/`；在线备份需使用 SQLite Backup API 或 `VACUUM INTO`，不要只复制运行中的主 `.db` 文件。
- 保存离线镜像包、Git 标签和备份的对应关系。
- 通过 `/healthz` 监控应用与数据库，日志使用 `docker compose logs`。
- 默认单实例 SQLite，适用于小团队。不要启动多个副本共享网络文件系统上的数据库。
- 当前共享管理密码仅提供基础访问隔离，所有已登录用户都有编辑和导出权限；需要细粒度权限时再接企业 SSO/RBAC。
