# Imagen base ligera con Node.js
FROM node:18-alpine

# Establece el directorio de trabajo
WORKDIR /app/backend

# Copia los archivos de dependencias primero
COPY backend/package*.json ./

# Instala las dependencias
RUN npm install 

# Copia el resto del código backend
COPY backend/. .

# Copia el frontend (si lo sirves desde backend)
COPY frontend ./frontend

# Expone el puerto del backend
EXPOSE 3000

# Comando por defecto: cambia según el servicio (admin o ruleta)
CMD ["node", "ruleta.js"]
