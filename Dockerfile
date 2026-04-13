FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 确保 data 目录存在并初始化数据库
RUN mkdir -p data && node init_db.js

EXPOSE 3000

CMD ["node", "server.v2fixed.js"]
