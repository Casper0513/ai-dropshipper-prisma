# 🟦 1. Base image
FROM node:18-alpine AS builder

WORKDIR /app

# 🟦 2. Copy package files
COPY package.json package-lock.json ./

# 🟦 3. Install dependencies BEFORE prisma generate
RUN npm install

# 🟦 4. Copy rest of the app
COPY . .

# 🟦 5. Generate Prisma client (NOW node_modules exists)
RUN npx prisma generate

# 🟦 6. Production stage
FROM node:18-alpine AS runner
WORKDIR /app

# Copy node_modules & prisma client
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
