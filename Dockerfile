FROM node:22-alpine

WORKDIR /app

COPY . .

ENV NODE_ENV=production
EXPOSE 4180

CMD ["node", "server.js"]
