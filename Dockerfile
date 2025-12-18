# =========================
# Builder
# =========================
FROM node:20.11.1 AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Build dashboard
WORKDIR /app/dashboard
RUN npm install


# Generate Prisma client
WORKDIR /app
RUN npx prisma generate

# =========================
# Runtime
# =========================
FROM node:20.11.1
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/dashboard/dist ./dashboard/dist

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
