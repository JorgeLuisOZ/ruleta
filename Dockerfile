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

# Copia el script de espera 
COPY espera-mysql.sh ./espera-mysql.sh

# Da permisos de ejecución al script dentro del contenedor
RUN chmod +x ./espera-mysql.sh

# Copia el frontend 
COPY frontend ./frontend

# Expone el puerto del backend
EXPOSE 3000

# Comando por defecto 
CMD ["node", "casino.js"]
