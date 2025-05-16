FROM node:18

EXPOSE 3000

WORKDIR /app

# Copiar solo los archivos de dependencias para instalar primero
COPY backend/package*.json ./backend/

WORKDIR /app/backend

RUN npm install

# Copiar el resto del código backend
COPY backend/. .

# Copiar el frontend dentro de la carpeta del backend para servirlo
COPY frontend ./frontend

# Ejecutar el backend (ruleta.js)
CMD ["node", "ruleta.js"]
