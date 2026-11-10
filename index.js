const express = require('express');
const mineflayer = require('mineflayer');
const app = express();
const PORT = process.env.PORT || 3000;

// 兼容垫片：强制用 1.21.4 解析器兼容 1.21.11
const mcData = require('minecraft-data');
if (!mcData.versionsByMinecraftVersion.pc['1.21.11']) {
    const v1214 = mcData.versionsByMinecraftVersion.pc['1.21.4'];
    if (v1214) {
        mcData.versionsByMinecraftVersion.pc['1.21.11'] = v1214;
        mcData.supportedVersions.pc.push('1.21.11');
    }
}

app.get('/', (req, res) => {
    const status = bots.map(b => ({
        id: b.id,
        username: b.options.username,
        host: `${b.options.host}:${b.options.port}`,
        status: b.activeBot && b.activeBot.entity ? 'online' : 'offline'
    }));
    res.json({
        message: 'Minecraft Multi-AFK 容器正在运行中...',
        bots: status
    });
});

app.get('/health', (req, res) => {
    res.json({ ok: true, botCount: bots.length });
});

app.listen(PORT, '0.0.0.0', () => console.log(`网页服务已成功绑定端口: ${PORT}`));

/**
 * 解析多账号配置
 * 支持两种方式：
 * 1. 环境变量 MC_BOTS = JSON 数组字符串
 *    例: [{"host":"server1.com","port":25565,"username":"Bot1","version":"1.21.1"},{"host":"server2.com","port":25565,"username":"Bot2"}]
 * 2. 兼容旧版单账号：MC_HOST / MC_PORT / MC_USER / MC_VERSION
 */
function loadBotConfigs() {
    const configs = [];

    // 优先使用 MC_BOTS JSON
    if (process.env.MC_BOTS) {
        try {
            const parsed = JSON.parse(process.env.MC_BOTS);
            if (Array.isArray(parsed)) {
                parsed.forEach((item, idx) => {
                    if (item.host && item.username) {
                        configs.push({
                            id: item.id || `bot-${idx + 1}`,
                            host: item.host,
                            port: parseInt(item.port) || 25565,
                            username: item.username,
                            version: item.version || '1.21.1',
                            auth: item.auth || 'offline' // offline / microsoft / mojang
                        });
                    }
                });
            }
        } catch (e) {
            console.error('[配置错误] MC_BOTS JSON 解析失败:', e.message);
        }
    }

    // 兼容旧版单账号环境变量
    if (configs.length === 0) {
        const host = process.env.MC_HOST;
        const username = process.env.MC_USER || 'Container_Bot';
        if (host) {
            configs.push({
                id: 'bot-1',
                host: host,
                port: parseInt(process.env.MC_PORT) || 25565,
                username: username,
                version: process.env.MC_VERSION || '1.21.1',
                auth: process.env.MC_AUTH || 'offline'
            });
        }
    }

    // 如果还是没有配置，使用默认值（方便本地测试）
    if (configs.length === 0) {
        console.warn('[警告] 未检测到任何机器人配置，使用默认单账号示例。请设置 MC_BOTS 或 MC_HOST 等环境变量。');
        configs.push({
            id: 'bot-1',
            host: 'localhost',
            port: 25565,
            username: 'Container_Bot',
            version: '1.21.1',
            auth: 'offline'
        });
    }

    return configs;
}

const botConfigs = loadBotConfigs();
console.log(`[配置] 共加载 ${botConfigs.length} 个账号:`);
botConfigs.forEach(c => console.log(`  - [${c.id}] ${c.username} @ ${c.host}:${c.port} (v${c.version})`));

// 每个 bot 的运行时状态
const bots = botConfigs.map(cfg => ({
    id: cfg.id,
    options: {
        host: cfg.host,
        port: cfg.port,
        username: cfg.username,
        version: cfg.version,
        auth: cfg.auth
    },
    activeBot: null,
    afkTimer: null,
    reconnectTimer: null,
    isReconnecting: false
}));

function cleanUp(botState) {
    if (botState.afkTimer) {
        clearInterval(botState.afkTimer);
        botState.afkTimer = null;
    }
    if (botState.reconnectTimer) {
        clearTimeout(botState.reconnectTimer);
        botState.reconnectTimer = null;
    }
    if (botState.activeBot) {
        try { botState.activeBot.quit(); } catch (e) {}
        botState.activeBot = null;
    }
}

function triggerReconnect(botState, delay) {
    if (botState.isReconnecting) return;
    botState.isReconnecting = true;

    cleanUp(botState);
    botState.reconnectTimer = setTimeout(() => {
        botState.isReconnecting = false;
        startBot(botState);
    }, delay);
}

function startBot(botState) {
    if (botState.isReconnecting) return;

    cleanUp(botState);
    const opts = botState.options;
    console.log(`[${botState.id}] [正在连接] ${opts.host}:${opts.port} 用户: ${opts.username}`);

    try {
        botState.activeBot = mineflayer.createBot(opts);
    } catch (err) {
        console.error(`[${botState.id}] [错误] 初始化失败:`, err.message);
        triggerReconnect(botState, 20000);
        return;
    }

    const bot = botState.activeBot;

    bot.on('spawn', () => {
        console.log(`[${botState.id}] [✔ 成功] ${bot.username} 已进入服务器。强化防挂机已启动。`);
        botState.isReconnecting = false;

        if (botState.afkTimer) clearInterval(botState.afkTimer);

        // ==================== 强化防挂机 ====================
        botState.afkTimer = setInterval(() => {
            if (!botState.activeBot || !botState.activeBot.entity) return;

            try {
                // 1. 转视角
                const yaw = botState.activeBot.entity.yaw + (Math.random() * 0.8 - 0.4);
                const pitch = Math.max(-1.0, Math.min(1.0, botState.activeBot.entity.pitch + (Math.random() * 0.4 - 0.2)));
                botState.activeBot.look(yaw, pitch, true);

                // 2. 持续向前走一段时间（关键）
                botState.activeBot.setControlState('forward', true);
                botState.activeBot.setControlState('sprint', Math.random() > 0.6);

                const walkTime = 1200 + Math.random() * 600;
                setTimeout(() => {
                    if (botState.activeBot) {
                        botState.activeBot.setControlState('forward', false);
                        botState.activeBot.setControlState('sprint', false);
                    }
                }, walkTime);

                // 3. 偶尔跳跃
                if (Math.random() < 0.35) {
                    botState.activeBot.setControlState('jump', true);
                    setTimeout(() => {
                        if (botState.activeBot) botState.activeBot.setControlState('jump', false);
                    }, 80);
                }

                // 4. 偶尔挥手
                if (Math.random() < 0.4) {
                    botState.activeBot.swingArm('right');
                }

                console.log(`[${botState.id}] [DEBUG] 防挂机动作已执行（行走 ${Math.round(walkTime)}ms）`);
            } catch (err) {
                console.error(`[${botState.id}] [ERROR] 防挂机异常:`, err.message);
            }
        }, 18000 + Math.floor(Math.random() * 4000)); // 18~22 秒，错开不同 bot
    });

    bot.on('end', (reason) => {
        console.log(`[${botState.id}] [❌ 掉线] 原因: ${reason}`);

        if (reason === 'socketClosed' || (typeof reason === 'string' && reason.includes('location'))) {
            console.log(`[${botState.id}] [网络保护] 将在 25 秒后重连...`);
            triggerReconnect(botState, 25000);
        } else {
            triggerReconnect(botState, 15000);
        }
    });

    bot.on('error', (err) => {
        console.error(`[${botState.id}] [⚠️ 网络错误]:`, err.message || err);
    });

    bot.on('kicked', (reason) => {
        console.warn(`[${botState.id}] [被踢出]`, reason);
    });
}

// 启动所有 bot，错开启动时间避免同时连接造成压力
bots.forEach((botState, index) => {
    const delay = 3000 + index * 2500; // 每个 bot 间隔 2.5 秒启动
    setTimeout(() => startBot(botState), delay);
});

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n正在关闭所有机器人...');
    bots.forEach(cleanUp);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n收到 SIGTERM，正在关闭所有机器人...');
    bots.forEach(cleanUp);
    process.exit(0);
});
