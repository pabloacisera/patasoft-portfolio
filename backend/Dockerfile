FROM node:20-alpine

WORKDIR /app

# openssl para Prisma, netcat para healthcheck
RUN apk add --no-cache openssl libc6-compat netcat-openbsd

RUN npm install -g prisma typescript ts-node

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# Compilar TypeScript a dist/
RUN npm run build

RUN chmod +x start.sh

EXPOSE 3000

CMD ["./start.sh"]