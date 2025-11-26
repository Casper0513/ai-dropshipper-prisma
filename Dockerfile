FROM node:20-alpine

WORKDIR /app

# Copy package files and install (include dev deps for Prisma CLI)
COPY package*.json ./
RUN npm install

# Copy app
COPY . .

# Generate Prisma client
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
