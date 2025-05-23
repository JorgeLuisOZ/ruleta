const express = require("express");
const path = require("path");
const mqtt = require("mqtt");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/login.html"));
});

app.get("/ruleta.html", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/ruleta.html"));
});

app.listen(PORT, () => {
  console.log(`🟢 Servidor frontend en http://localhost:${PORT}`);
});

// ============================
// Conexión MQTT para validación de usuarios y reenvío de estado
// ============================

const client = mqtt.connect("mqtt://broker-mqtt");

let jugadores = new Set();
let estadoActual = { mensaje: "esperando apuestas de los jugadores..." }; // valor por defecto
let historialChat = []; // 30 mensajes


client.on("connect", () => {
  console.log("✅ Backend conectado al broker MQTT");
  client.subscribe("ruleta/jugadores");
  client.subscribe("ruleta/chat");

  // Escuchar cambios de estado publicados por el admin
  client.subscribe("ruleta/estado");
});

client.on("message", (topic, message) => {
  const payload = message.toString();

  if (topic === "ruleta/jugadores") {
    try {
      const data = JSON.parse(payload);
      const usuario = data.usuario?.trim();
      const origen = data.origen;

      if (!usuario) return;

      const yaExiste = jugadores.has(usuario);

      if (origen === "login") {
        if (yaExiste) {
          client.publish(`ruleta/validacion/${usuario}`, JSON.stringify({ valido: false }));
          console.log(`❌ Usuario duplicado rechazado: ${usuario}`);
        } else {
          jugadores.add(usuario);
          client.publish(`ruleta/validacion/${usuario}`, JSON.stringify({ valido: true }));
          console.log(`🟢 Usuario registrado: ${usuario}`);
        }
      } else if (origen === "ruleta") {
        if (yaExiste) {
          client.publish("ruleta/estado", JSON.stringify(estadoActual));
          console.log(`🔁 Estado reenviado a ${usuario}`);
        }
      }
    } catch (e) {
      console.error("❌ Error procesando jugador:", e);
    }
  }

  if (topic === "ruleta/estado") {
    try {
      estadoActual = JSON.parse(payload);
    } catch (e) {
      console.error("❌ Error actualizando estado actual:", e);
    }
  }

  if (topic === "ruleta/chat") {
    try {
      const msg = JSON.parse(payload);

      // Mensaje válido de cliente, lo reenviamos a todos como string plano
      if (msg.origen === "cliente") {
        const mensajePlano = `${msg.usuario}: ${msg.texto}`;
        historialChat.push(mensajePlano);
        if (historialChat.length > 30) historialChat.shift();

        // 👇 IMPORTANTE: usar un tópico diferente para reenviar
        client.publish("ruleta/chat/visible", mensajePlano);
        console.log("💬 Mensaje enviado:", mensajePlano);
      }
    } catch (e) {
      // Si falla el parseo es porque ya es string plano → ignorar
    }
  }

});
