# =========================
# Builder
# =========================
FROM node:20.11.1 AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

RUN npx prisma generate

# =========================
# Runner
# =========================
FROM node:20.11.1 AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
