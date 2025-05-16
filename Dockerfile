FROM node:18

EXPOSE 3000

WORKDIR /app

COPY backend/package*.json ./backend/

WORKDIR /app/backend

RUN npm install

COPY backend/. .

CMD ["node", "ruleta.js"]
