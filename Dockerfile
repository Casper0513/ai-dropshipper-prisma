# ---------------------------------------------------
# 🔥 Use Debian-based Node image — NOT alpine
# ---------------------------------------------------
FROM node:25.1.0 AS builder

WORKDIR /app

# ---------------------------------------------------
# Copy package.json and install deps
# ---------------------------------------------------
COPY package.json ./
RUN npm install

# ---------------------------------------------------
# Copy app code
# ---------------------------------------------------
COPY . .

# ---------------------------------------------------
# Prisma generate — NO wasm overrides
# ---------------------------------------------------
RUN npx prisma generate

# ---------------------------------------------------
# Runtime stage
# ---------------------------------------------------
FROM node:25.1.0 AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
