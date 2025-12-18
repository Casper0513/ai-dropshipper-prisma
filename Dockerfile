# =========================
# 1️⃣ Build stage
# =========================
FROM node:18.20.4 AS builder

WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install

# Copy full project
COPY . .

# Build dashboard with Vite
WORKDIR /app/dashboard
RUN npm run build

# Build Prisma client
WORKDIR /app
RUN npx prisma generate

# =========================
# 2️⃣ Runtime stage
# =========================
FROM node:18.20.4 AS runner

WORKDIR /app

# Copy runtime deps
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

# ✅ THIS is the important line
COPY --from=builder /app/dashboard/dist ./dashboard/dist

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
