const express = require('express');
const mineflayer = require('mineflayer');
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== 多服务器配置 ====================
let servers = [];

try {
    if (process.env.SERVERS) {
        servers = JSON.parse(process.env.SERVERS);
        if (!Array.isArray(servers)) throw new Error('SERVERS 必须是数组');
        console.log(`[配置] 已从环境变量 SERVERS 加载 ${servers.length} 个服务器`);
    } else {
        servers = [{
            host: process.env.MC_HOST || 'join.wrdnpz',
            port: parseInt(process.env.MC_PORT) || 25482,
            username: process.env.MC_USER || 'Bot1',
            version: process.env.MC_VERSION || '26.1'   // 强制用 26.1
        }];
        console.log('[配置] 使用默认单服务器配置');
    }
} catch (err) {
    console.error('[错误] 解析 SERVERS 失败:', err.message);
    process.exit(1);
}

// =====================================================================

app.get('/', (req, res) => {
    const list = servers.map(s => `${s.username} → ${s.host}:${s.port} (${s.version})`).join('<br>');
    res.send(`
        <h2>Minecraft 多服务器 AFK 挂机容器运行中</h2>
        <p>当前配置了 <b>${servers.length}</b> 个服务器：</p>
        <p>${list}</p>
        <p style="color:orange">注意：当前使用 26.1 协议连接（通过服务器 ViaVersion 或本地 ViaProxy）</p>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`网页服务已成功绑定端口: ${PORT}`);
});

function startBot(options) {
    const serverTag = `${options.host}:${options.port}`;
    console.log(`[${serverTag}] 尝试连接... (用户名: ${options.username}, 版本: ${options.version})`);

    const bot = mineflayer.createBot({
        host: options.host,
        port: options.port || 25565,
        username: options.username || 'AFK_Bot',
        version: options.version || '26.1',   // 强制 26.1
        // auth: 'offline',                   // 离线服用这个
    });

    bot.on('spawn', () => {
        console.log(`[成功] ${options.username} 已进入服务器 ${serverTag}`);
        
        // 静默保活
        setInterval(() => {
            if (bot.entity) {
                bot.look(bot.entity.yaw, bot.entity.pitch, true);
            }
        }, 30000);
    });

    bot.on('end', (reason) => {
        console.log(`[${serverTag}] 连接断开 (${reason})，15秒后重连...`);
        setTimeout(() => startBot(options), 15000);
    });

    bot.on('error', (err) => {
        console.error(`[${serverTag}] 错误:`, err.message || err);
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
            setTimeout(() => startBot(options), 20000);
        }
    });

    bot.on('kicked', (reason) => {
        console.log(`[${serverTag}] 被踢出:`, reason);
    });
}

setTimeout(() => {
    console.log(`准备启动 ${servers.length} 个服务器的机器人...`);
    servers.forEach((server, index) => {
        setTimeout(() => startBot(server), index * 3000);
    });
}, 2000);
