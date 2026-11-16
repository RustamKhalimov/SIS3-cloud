
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY worker.js ./
COPY src ./src

EXPOSE 8080

CMD ["npm", "start"]
