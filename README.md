# 🎰 Ruleta Multijugador con MQTT y Docker

Este proyecto implementa una ruleta multijugador en tiempo real utilizando MQTT como protocolo de mensajería, Node.js como backend y Docker para contenerizar el entorno completo. El sistema permite a múltiples jugadores apostar de forma simultánea, guardar el historial de apuestas en MySQL y visualizarlo mediante una interfaz animada con calendario.

---

## ✍️ Autores

- Angel Alexander Alducin Diaz 
- Fernando Escobar Robles
- Jorge Luis Ortega Zenteno
- Axel Alain Vasquez Ramirez

---

## 📦 Tecnologías utilizadas

- Node.js  
- MQTT (via `rrojano/mqtt`)  
- MySQL 5.7  
- Docker y Docker Compose  
- HTML, CSS y JS para el frontend  
- Visual Studio Code para desarrollo y automatización de tareas  

---

## 🕒 Formato de fechas

- Todas las fechas se almacenan en formato `DATETIME` y se insertan automáticamente al momento de registrar una apuesta.
- El timezone del contenedor MySQL está configurado en `America/Mexico_City`, por lo que **las fechas y horas reflejan la hora real de México**.
- Las fechas en el historial se muestran en formato legible (`5 de Junio de 2025`), y en la base de datos se almacenan como `2025-06-05 14:30:00`.

---

## 🧱 Requisitos Previos

- Tener [Docker](https://www.docker.com/products/docker-desktop) instalado y en ejecución.
- Tener [Visual Studio Code](https://code.visualstudio.com/) con soporte para tareas.
- Asegurarse de que el puerto `3307`, `3000`, `1883` y `9001` no estén ocupados.

---

## ⚙️ Configuración y ejecución

### 📁 1. Configurar tareas en Visual Studio Code

El archivo `tasks.json` permite iniciar el entorno Docker fácilmente dependiendo del sistema operativo:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Iniciar Ruleta Docker Windows",
      "type": "shell",
      "command": ".\\iniciar-ruleta.bat",
      "group": "build",
      "problemMatcher": []
    },
    {
      "label": "Iniciar Ruleta Docker MacOS",
      "type": "shell",
      "command": "./iniciar-ruleta.sh",
      "group": "build",
      "problemMatcher": []
    }
  ]
}
```

---

### 💻 2. Scripts de inicio incluidos

#### ✅ Windows – `iniciar-ruleta.bat`
```bat
@echo off
echo 🔄 Cerrando contenedores y limpiando volúmenes...
docker-compose down --volumes --remove-orphans

echo 🛠 Reconstruyendo imagen desde cero...
docker-compose build --no-cache

echo 🚀 Iniciando contenedores...
docker-compose up
```

#### ✅ MacOS/Linux – `docker_cleanup.sh`
```bash
#!/bin/bash
echo "🔄 Cerrando contenedores y limpiando volúmenes..."
docker-compose down --volumes --remove-orphans

echo "🛠 Reconstruyendo imagen desde cero..."
docker-compose build --no-cache

echo "🚀 Iniciando contenedores..."
docker-compose up
```

---

### ▶️ 3. Ejecutar desde Visual Studio Code

1. Abre el proyecto en VS Code.
2. Presiona `Ctrl+Shift+B` o `Cmd+Shift+B` → `Run Task`.
3. Selecciona una de las dos tareas según tu sistema:
   - `Iniciar Ruleta Docker Windows`
   - `Iniciar Ruleta Docker MacOS`

---

## 🧩 Estructura de Carpetas

```
ruleta/
├── .vscode/
│   └── tasks.json
├── backend/
│   ├── casino.js
│   ├── ruleta.js
│   └── package.json
├── data/
│   └── ...
├── frontend/
│   ├── css/
│   │   ├── historial.css
│   │   ├── login.css
│   │   └── ruleta.css
│   ├── img/
│   │   └── ...
│   ├── js/
│   │   ├── historial.js
│   │   ├── login.js
│   │   └── main.js
│   ├── historial.html
│   ├── login.html
│   └── ruleta.html
├── mqtt/
│   └── mqtt.conf
├── mysql/
│   └── init.mysql
├── .dockerignore
├── .gitattributes
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── espera-mysql.sh
├── iniciar-ruleta.bat
├── iniciar-ruleta.sh
└── README.md
```

---

## 📆 Historial de apuestas

- Se accede mediante un calendario animado en `historial.html`.
- Los días con apuestas muestran una ficha.
- Al hacer clic en una fecha, se despliega un modal con todas las apuestas registradas ese día.

---

## 📬 Contacto

Para dudas o sugerencias, puedes comunicarte con cualquiera de los autores mencionados arriba.
