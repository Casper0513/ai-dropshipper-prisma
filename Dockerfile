# ---------------------------------------------------
# 🔥 MUST USE NODE 22 FOR PRISMA 7
# ---------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# ---------------------------------------------------
# 🔥 Important Prisma 7 engine env vars
# ---------------------------------------------------
ENV PRISMA_CLI_QUERY_ENGINE_LIBRARY="wasm"
ENV PRISMA_CLI_ENGINE_TYPE="library"
ENV PRISMA_GENERATE_SKIP_POSTINSTALL="true"
ENV PRISMA_MIGRATE_ENGINE_BINARY="wasm"
ENV PRISMA_SCHEMA_ENGINE_BINARY="wasm"
ENV PRISMA_QUERY_ENGINE_LIBRARY="wasm"
ENV PRISMA_ENGINES_CHECKSUM_IGNORE="true"

# ---------------------------------------------------
# Copy package.json and install deps
# ---------------------------------------------------
COPY package.json ./

RUN npm install

# ---------------------------------------------------
# Copy all project files
# ---------------------------------------------------
COPY . .

# ---------------------------------------------------
# 🔥 Run Prisma generate (WASM engine mode)
# ---------------------------------------------------
RUN npx prisma generate --data-proxy=false --no-engine

# ---------------------------------------------------
# Runtime stage
# ---------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
