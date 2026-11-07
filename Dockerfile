FROM node:18-slim

# 安装 Java（ViaProxy 需要）
RUN apt-get update && \
    apt-get install -y --no-install-recommends openjdk-17-jre-headless wget ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 下载 ViaProxy（支持 26.3）
RUN wget -O ViaProxy.jar https://github.com/ViaVersion/ViaProxy/releases/download/v3.4.14/ViaProxy-3.4.14.jar

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
