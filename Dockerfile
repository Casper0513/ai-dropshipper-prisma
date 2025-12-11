# 🟦 1. Base image — MUST be Node 20+ for Prisma 7
FROM node:22-alpine AS builder

WORKDIR /app

# 🟦 2. Copy package.json (no lockfile needed)
COPY package.json ./

# 🟦 3. Install dependencies BEFORE prisma generate
RUN npm install

# 🟦 4. Copy app code
COPY . .

# 🟦 5. Prisma generate AFTER node_modules exist
RUN npx prisma generate

# 🟦 6. Build (only if using TypeScript)
# If JS only, remove this line
# RUN npm run build

# 🟦 7. Build lightweight runtime image
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
# If you use dist/ from TypeScript, copy dist instead:
# COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

# If JS runs from src (no TypeScript):
CMD ["node", "src/server.js"]

# If TypeScript build output lives in dist:
# CMD ["node", "dist/server.js"]
