const express = require('express');
const mineflayer = require('mineflayer');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== 配置区域 ====================
// 环境变量 SERVERS 示例（推荐用这个）：
/*
[
  {
    "host": "join.wrd.kr",
    "port": 25482,
    "username": "Bot26_3",
    "version": "26.3",
    "useProxy": true
  },
  {
    "host": "play.example.com",
    "port": 25565,
    "username": "Bot26_1",
    "version": "26.1",
    "useProxy": false
  },
  {
    "host": "mc.another.com",
    "port": 25565,
    "username": "Bot121",
    "version": "1.21.11",
    "useProxy": false
  }
]
*/

// 机器人实际使用的协议版本（ViaProxy 翻译后的版本）
const BOT_PROTOCOL_VERSION = process.env.BOT_PROTOCOL_VERSION || '26.1';

// 本地代理起始端口
const PROXY_BASE_PORT = parseInt(process.env.PROXY_BASE_PORT) || 25568;

// 不支持直接连接、需要走代理的版本（可自行扩展）
const NEED_PROXY_VERSIONS = ['26.3', '26.2']; // 根据实际情况调整

// ==================================================

let servers = [];
try {
  if (process.env.SERVERS) {
    servers = JSON.parse(process.env.SERVERS);
    if (!Array.isArray((servers)) throw new Error('SERVERS 必须是 JSON 数组');
  } else {
    // 兼容旧单服务器写法
    servers = [{
      host: process.env.MC_HOST || '127.0.0.1',
      port: parseInt(process.env.MC_PORT) || 25565,
      username: process.env.MC_USER || 'Bot1',
      version: process.env.MC_VERSION || '26.1',
      useProxy: process.env.USE_PROXY === 'true'
    }];
  }
} catch (err) {
  console.error('[配置错误]', err.message);
  process.exit(1);
}

// 记录已启动的代理进程
const proxyProcesses = new Map(); // key: host:port → { port, process }

// 判断是否需要代理
function needsProxy(server) {
  if (typeof server.useProxy === 'boolean') return server.useProxy;
  // 自动判断
  return NEED_PROXY_VERSIONS.includes(server.version);
}

// 启动一个 ViaProxy 实例
function startViaProxy(targetHost, targetPort, targetVersion, localPort) {
  return new Promise((resolve, reject) => {
    console.log(`[ViaProxy] 启动中 → 本地:${localPort}  →  ${targetHost}:${targetPort} (${targetVersion})`);

    const args = [
      '-Xms64M',
      '-Xmx256M',
      '-jar', 'ViaProxy.jar',
      'cli',
      '--bind-address', `127.0.0.1:${localPort}`,
      '--target-address', `${targetHost}:${targetPort}`,
      '--target-version', targetVersion,
      '--auth-method', 'none'
    ];

    const proc = spawn('java', args, {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let started = false;

    const timer = setTimeout(() => {
      if (!started) {
        console.log(`[ViaProxy] 本地端口 ${localPort} 启动超时，继续尝试...`);
        started = true;
        resolve(proc);
      }
    }, 8000);

    proc.stdout.on('data', (data) => {
      const msg = data.toString();
      // 简单判断是否启动成功
      if (!started && (msg.includes('Started') || msg.includes('listening') || msg.includes('Bound'))) {
        clearTimeout(timer);
        started = true;
        console.log(`[ViaProxy] 本地端口 ${localPort} 启动成功`);
        resolve(proc);
      }
    });

    proc.stderr.on('data', (data) => {
      // 可选：打印错误
      // console.error(`[ViaProxy ${localPort}]`, data.toString().trim());
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('exit', (code) => {
      console.log(`[ViaProxy] 本地端口 ${localPort} 已退出，code=${code}`);
    });
  });
}

// 为需要代理的服务器准备代理
async function prepareProxies() {
  let nextPort = PROXY_BASE_PORT;

  for (const server of servers) {
    if (!needsProxy(server)) continue;

    const key = `${server.host}:${server.port}`;
    if (proxyProcesses.has(key)) {
      // 已经有代理了，复用
      server._proxyPort = proxyProcesses.get(key).port;
      continue;
    }

    const localPort = nextPort++;
    try {
      const proc = await startViaProxy(server.host, server.port, server.version, localPort);
      proxyProcesses.set(key, { port: localPort, process: proc });
      server._proxyPort = localPort;
    } catch (err) {
      console.error(`[ViaProxy] 启动失败 (${key}):`, err.message);
    }
  }
}

// ==================== 机器人相关 ====================

function startBot(server) {
  const useProxy = needsProxy(server);
  const connectHost = useProxy ? '127.0.0.1' : server.host;
  const connectPort = useProxy ? server._proxyPort : server.port;
  const connectVersion = useProxy ? BOT_PROTOCOL_VERSION : server.version;
  const username = server.username || 'AFK_Bot';

  console.log(`[${username}] 准备连接 → ${connectHost}:${connectPort} 版本:${connectVersion} ${useProxy ? '(通过代理)' : '(直连)'}`);

  const bot = mineflayer.createBot({
    host: connectHost,
    port: connectPort,
    username: username,
    version: connectVersion,
    // auth: 'offline', // 离线服可打开
  });

  bot.on('spawn', () => {
    console.log(`[成功] ${username} 已进入服务器（${useProxy ? '代理' : '直连'}）`);
    
    // 静默保活
    setInterval(() => {
      if (bot.entity) {
        bot.look(bot.entity.yaw, bot.entity.pitch, true);
      }
    }, 30000);
  });

  bot.on('end', (reason) => {
    console.log(`[${username}] 断开 (${reason})，15秒后重连...`);
    setTimeout(() => startBot(server), 15000);
  });

  bot.on('error', (err) => {
    console.error(`[${username}] 错误:`, err.message || err);
    setTimeout(() => startBot(server), 20000);
  });

  bot.on('kicked', (reason) => {
    console.log(`[${username}] 被踢出:`, reason);
  });
}

// ==================== 启动流程 ====================

app.get('/', (req, res) => {
  const info = servers.map(s => ({
    username: s.username,
    target: `${s.host}:${s.port}`,
    version: s.version,
    mode: needsProxy(s) ? `代理 → 127.0.0.1:${s._proxyPort}` : '直连'
  }));

  res.send(`
    <h2>Minecraft 多服务器 AFK + ViaProxy 完整版</h2>
    <p>当前配置了 <b>${servers.length}</b> 个机器人</p>
    <pre>${JSON.stringify(info, null, 2)}</pre>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`网页服务已绑定端口: ${PORT}`);
});

(async () => {
  console.log(`[配置] 共加载 ${servers.length} 个服务器`);
  
  // 先启动所有需要的代理
  await prepareProxies();

  console.log('准备启动机器人...');
  // 错开启动，避免同时连接
  servers.forEach((server, index) => {
    setTimeout(() => startBot(server), index * 4000 + 2000);
  });
})();

// 优雅退出
process.on('SIGINT', () => {
  console.log('正在关闭所有 ViaProxy...');
  for (const { process: proc } of proxyProcesses.values()) {
    try { proc.kill(); } catch (e) {}
  }
  process.exit(0);
});
