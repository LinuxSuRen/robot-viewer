# ─── 构建阶段 ───────────────────────────────────────────────────────────
FROM registry.cn-hangzhou.aliyuncs.com/linuxsuren/node:20-bookworm AS build

WORKDIR /app

# 安装依赖（含 devDependencies，因为需要 tsc + vite）
COPY package.json package-lock.json ./
RUN npm ci

# 构建
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY public/ public/
COPY src/ src/
COPY index.html ./
RUN npm run build

# ─── 生产阶段 ───────────────────────────────────────────────────────────
FROM registry.cn-hangzhou.aliyuncs.com/linuxsuren/node:20-bookworm

WORKDIR /app

# 只拷贝运行时所需文件
COPY --from=build /app/dist ./dist
COPY server/ ./server/
COPY --from=build /app/package.json /app/package-lock.json ./

# 只安装运行时依赖
RUN npm ci --omit=dev

EXPOSE 8090

CMD ["node", "server/index.js"]
