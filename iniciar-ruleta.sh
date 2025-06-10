#!/bin/bash

echo "🔄 Cerrando contenedores y limpiando volúmenes..."
docker-compose down --volumes --remove-orphans

echo "🛠 Reconstruyendo imagen desde cero..."
docker-compose build --no-cache

echo "🚀 Iniciando contenedores..."
docker-compose up
