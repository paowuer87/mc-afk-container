const express = require('express');
// 使用支持 26.3 的 fork
const mineflayer = require('@wp2508/mineflayer');
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== 多服务器配置（优先读取环境变量） ====================
/**
 * 推荐使用环境变量 SERVERS，传入 JSON 字符串
 * 示例：
 * SERVERS='[
 *   {"host":"join.wrdnpz","port":25482,"username":"Bot1","version":"26.3"},
 *   {"host":"另一个服务器.com","port":25565,"username":"Bot2","version":"1.21.1"}
 * ]'
 */
let servers = [];

try {
    if (process.env.SERVERS) {
        servers = JSON.parse(process.env.SERVERS);
        if (!Array.isArray(servers)) {
            throw new Error('SERVERS 必须是数组');
        }
        console.log(`[配置] 已从环境变量 SERVERS 加载 ${servers.length} 个服务器`);
    } else {
        // 没有设置 SERVERS 时使用默认配置
        servers = [
            {
                host: process.env.MC_HOST || 'join.wrdnpz',
                port: parseInt(process.env.MC_PORT) || 25482,
                username: process.env.MC_USER || 'Bot1',
                version: process.env.MC_VERSION || '26.3'
            }
        ];
        console.log('[配置] 未检测到 SERVERS 环境变量，使用默认单服务器配置');
    }
} catch (err) {
    console.error('[错误] 解析 SERVERS 环境变量失败:', err.message);
    console.error('请检查 JSON 格式是否正确');
    process.exit(1);
}

// =====================================================================

app.get('/', (req, res) => {
    const list = servers.map(s => `${s.username} → ${s.host}:${s.port} (${s.version})`).join('<br>');
    res.send(`
        <h2>Minecraft 多服务器 AFK 挂机容器运行中</h2>
        <p>当前配置了 <b>${servers.length}</b> 个服务器：</p>
        <p>${list}</p>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`网页服务已成功绑定端口: ${PORT}`);
});

/**
 * 启动单个服务器的机器人
 */
function startBot(options) {
    const serverTag = `${options.host}:${options.port}`;
    console.log(`[${serverTag}] 尝试连接... (用户名: ${options.username}, 版本: ${options.version})`);

    const bot = mineflayer.createBot({
        host: options.host,
        port: options.port || 25565,
        username: options.username || 'AFK_Bot',
        version: options.version || false,   // 传 false 会尝试自动检测
        // auth: 'offline',                 // 如果是离线服可以加这行
    });

    bot.on('spawn', () => {
        console.log(`[成功] ${options.username} 已进入服务器 ${serverTag}，进入静默保活模式`);

        // 每 30 秒微调一次视角（静默保活）
        setInterval(() => {
            if (bot.entity) {
                bot.look(bot.entity.yaw, bot.entity.pitch, true);
            }
        }, 30000);
    });

    bot.on('end', (reason) => {
        console.log(`[${serverTag}] 连接断开 (${reason})，15秒后自动重连...`);
        setTimeout(() => startBot(options), 15000);
    });

    bot.on('error', (err) => {
        console.error(`[${serverTag}] 发生错误:`, err.message || err);
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
            setTimeout(() => startBot(options), 20000);
        }
    });

    bot.on('kicked', (reason) => {
        console.log(`[${serverTag}] 被踢出服务器:`, reason);
    });
}

// 延迟启动
setTimeout(() => {
    console.log(`准备启动 ${servers.length} 个服务器的机器人...`);
    servers.forEach((server, index) => {
        // 错开启动时间
        setTimeout(() => {
            startBot(server);
        }, index * 3000);
    });
}, 2000);
