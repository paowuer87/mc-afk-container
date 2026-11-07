const express = require('express');
const mineflayer = require('mineflayer');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 创建一个微型网页服务器，防止容器平台因为没有监听到端口而判定部署失败
app.get('/', (req, res) => {
    res.send('Minecraft AFK 挂机容器正在运行中...');
});

app.listen(PORT, () => {
    console.log(`网页服务已成功绑定端口: ${PORT}`);
});

// 2. Minecraft 机器人配置（优先读取环境变量，保护隐私）
const botOptions = {
    host: process.env.MC_HOST || 'eu16-free.falixserver.net', 
    port: parseInt(process.env.MC_PORT) || 28907,     
    username: process.env.MC_USER || 'Container_Bot', 
    version: process.env.MC_VERSION || '1.21.1'       
};

function startBot() {
    console.log(`尝试连接至服务器 -> ${botOptions.host}:${botOptions.port}`);
    const bot = mineflayer.createBot(botOptions);

    bot.on('spawn', () => {
        console.log(`[成功] 机器人 ${bot.username} 已进入服务器。`);
        
        // 每 8 秒微动或跳跃一次，防止被游戏内防挂机踢出
        setInterval(() => {
            if (bot.entity) {
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 500);
            }
        }, 8000);
    });

    bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        console.log(`[聊天] <${username}>: ${message}`);
    });

    // 掉线自动重连
    bot.on('end', (reason) => {
        console.log(`连接断开 (${reason})，15秒后自动重连...`);
        setTimeout(startBot, 15000);
    });

    bot.on('error', (err) => {
        console.error('发生错误:', err);
    });
}

// 延迟 5 秒启动机器人，确保网页服务先起来
setTimeout(startBot, 5000);
