#!/bin/sh

echo "⏳ Esperando a que MySQL esté listo..."
until nc -z mysql 3306; do
  sleep 2
done

echo "✅ MySQL está listo. Iniciando..."
exec "$@"
