# =========================
# Builder stage
# =========================
FROM node:20.11.1 AS builder
WORKDIR /app

# -------------------------
# Root dependencies
# -------------------------
COPY package.json ./
RUN npm install

# -------------------------
# Copy dashboard FIRST
# -------------------------
COPY dashboard ./dashboard

# -------------------------
# Build dashboard (Vite)
# -------------------------
WORKDIR /app/dashboard
RUN npm install
RUN npm run build

# -------------------------
# Copy backend AFTER
# -------------------------
WORKDIR /app
COPY src ./src
COPY prisma ./prisma

RUN npx prisma generate

# =========================
# Runtime stage
# =========================
FROM node:20.11.1
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dashboard/dist ./dashboard/dist

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
