const express = require('express');
const mineflayer = require('mineflayer');
const app = express();
const PORT = process.env.PORT || 3000;

// 【核心修改 1】如果最新库依然报错，这行垫片代码会强制让 mineflayer 用 1.21.4 的解析器去兼容服务器的 1.21.11，防止本地抛出不支持的异常
const mcData = require('minecraft-data');
if (!mcData.versionsByMinecraftVersion.pc['1.21.11']) {
    const v1214 = mcData.versionsByMinecraftVersion.pc['1.21.4'];
    if (v1214) {
        mcData.versionsByMinecraftVersion.pc['1.21.11'] = v1214;
        mcData.supportedVersions.pc.push('1.21.11');
    }
}

app.get('/', (req, res) => res.send('Minecraft AFK 挂机容器正在运行中...'));
app.listen(PORT, '0.0.0.0', () => console.log(`网页服务已成功绑定端口: ${PORT}`));

const botOptions = {
    host: 'eu16-free.falixserver.net', 
    port: 28907,     
    username: 'Container_Bot', 
    version: '1.21.11'  
};

function startBot() {
    console.log(`尝试连接至服务器 -> ${botOptions.host}:${botOptions.port}`);
    const bot = mineflayer.createBot(botOptions);

    bot.on('spawn', () => {
        console.log(`[成功] 机器人 ${bot.username} 已成功进入服务器。已切换为静默保活模式。`);
        
        // 每 30 秒静默微调视角，发送合法的微小动作包，规避反作弊并且绝不消耗服务器内存
        setInterval(() => {
            if (bot.entity) {
                bot.look(bot.entity.yaw, bot.entity.pitch, true);
            }
        }, 30000);
    });

    bot.on('end', (reason) => {
        console.log(`连接断开 (${reason})，15秒后自动重连...`);
        setTimeout(startBot, 15000);
    });

    bot.on('error', (err) => {
        console.error('发生错误:', err.message || err);
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
            setTimeout(startBot, 20000);
        }
    });
}

setTimeout(startBot, 2000);
