FROM node:18.20.4

WORKDIR /app/dashboard

COPY package.json ./

RUN npm install

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production

CMD ["node", "src/server.js"]

