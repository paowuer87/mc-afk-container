# mc-afk-container

Minecraft 多账号 24/7 AFK 挂机容器（基于 mineflayer）

支持**同时登录多个账号**到**不同的 Minecraft 服务器**，每个账号独立运行防挂机逻辑与自动重连。

## 功能

- 多账号 / 多服务器同时挂机
- 强化防挂机（随机转视角、行走、跳跃、挥手）
- 掉线自动重连
- HTTP 健康检查与状态查询
- Docker 一键部署
- 兼容旧版单账号环境变量

## 配置方式

### 方式一：多账号（推荐）

设置环境变量 `MC_BOTS` 为 JSON 数组：

```json
[
  {
    "id": "bot-a",
    "host": "server1.example.com",
    "port": 25565,
    "username": "MyBot1",
    "version": "1.21.1"
  },
  {
    "id": "bot-b",
    "host": "play.hypixel.net",
    "port": 25565,
    "username": "MyBot2",
    "version": "1.21.1"
  },
  {
    "host": "another.server.com",
    "port": 25566,
    "username": "MyBot3",
    "version": "1.20.4",
    "auth": "offline"
  }
]
```

字段说明：

| 字段       | 必填 | 说明                          | 默认值     |
|------------|------|-------------------------------|------------|
| id         | 否   | 日志标识                      | bot-1, bot-2... |
| host       | 是   | 服务器地址                    | -          |
| port       | 否   | 端口                          | 25565      |
| username   | 是   | 游戏名（离线模式）            | -          |
| version    | 否   | Minecraft 版本                | 1.21.1     |
| auth       | 否   | offline / microsoft / mojang  | offline    |

### 方式二：单账号（兼容旧版）

```bash
MC_HOST=your.server.com
MC_PORT=25565
MC_USER=YourBotName
MC_VERSION=1.21.1
```

## 本地运行

```bash
npm install
# 多账号示例
export MC_BOTS='[{"host":"127.0.0.1","port":25565,"username":"Bot1"},{"host":"127.0.0.1","port":25566,"username":"Bot2"}]'
npm start
```

## Docker 运行

```bash
# 构建
docker build -t mc-afk-container .

# 多账号运行示例
docker run -d \
  -p 3000:3000 \
  -e MC_BOTS='[{"host":"server1.com","port":25565,"username":"Bot1","version":"1.21.1"},{"host":"server2.com","port":25565,"username":"Bot2"}]' \
  --name mc-afk \
  mc-afk-container
```

或使用 GitHub Container Registry 镜像（如果已推送）：

```bash
docker run -d \
  -p 3000:3000 \
  -e MC_BOTS='[...]' \
  ghcr.io/yexu87/mc-afk-container:latest
```

## 状态查询

- `GET /`          → 返回所有 bot 在线状态
- `GET /health`    → 健康检查

示例返回：

```json
{
  "message": "Minecraft Multi-AFK 容器正在运行中...",
  "bots": [
    {
      "id": "bot-a",
      "username": "MyBot1",
      "host": "server1.example.com:25565",
      "status": "online"
    },
    {
      "id": "bot-b",
      "username": "MyBot2",
      "host": "play.hypixel.net:25565",
      "status": "offline"
    }
  ]
}
```

## 注意事项

1. **正版验证**：默认使用 `offline`（盗版/离线）模式。若服务器开启正版验证，需要 `auth: "microsoft"` 并配合额外登录流程（当前版本以离线模式为主）。
2. 不同 bot 启动时间会自动错开，降低同时连接压力。
3. 防挂机间隔约 18~22 秒，并带随机动作。
4. 容器平台请确保持久运行（如 Railway、Render、自建 VPS 等）。

## License

MIT
