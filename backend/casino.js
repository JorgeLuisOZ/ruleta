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
// Conexión MQTT y lógica central
// ============================

const client = mqtt.connect("mqtt://broker-mqtt");

let jugadores = new Set();
let estadoActual = { mensaje: "esperando apuestas de los jugadores..." };
let historialChat = [];
let apuestas = [];

client.on("connect", () => {
  console.log("✅ Casino.js conectado al broker MQTT");

  client.subscribe("ruleta/jugadores");
  client.subscribe("ruleta/mensajes"); 
  client.subscribe("ruleta/estado");
  client.subscribe("ruleta/apuestas");
  client.subscribe("ruleta/numeroGanador");
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
        client.publish(`ruleta/validacion/${usuario}`, JSON.stringify({ valido: !yaExiste }));
        if (!yaExiste) jugadores.add(usuario);
        console.log(`${yaExiste ? "❌" : "🟢"} Usuario ${yaExiste ? "rechazado" : "registrado"}: ${usuario}`);
      } else if (origen === "ruleta" && yaExiste) {
        client.publish("ruleta/estado", JSON.stringify(estadoActual));
        console.log(`🔁 Estado reenviado a ${usuario}`);
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

  // Flujo de mensajes de chat
  if (topic === "ruleta/mensajes") {
    try {
      const msg = JSON.parse(payload);
      if (msg.origen === "cliente" && msg.usuario && msg.texto) {
        const mensajePlano = `${msg.usuario}: ${msg.texto}`;
        historialChat.push(mensajePlano);
        if (historialChat.length > 30) historialChat.shift();

        // 👇 Publica en el canal oficial que los clientes escuchan
        client.publish("ruleta/chat", JSON.stringify({
          texto: mensajePlano,
          origen: "sistema"
        }));

        console.log("💬 Mensaje de →", mensajePlano);
      }
    } catch (e) {
      console.error("❌ Error procesando mensaje de jugador:", e);
    }
  }

  if (topic === "ruleta/apuestas") {
    try {
      const { usuario, numero } = JSON.parse(payload);
      const validas = [
        "Rojo", "Negro", "Par", "Impar", "1–18", "1-18", "19–36", "19-36", "2to1"
      ];
      if (!usuario || (isNaN(parseInt(numero)) && !validas.includes(numero))) return;

      apuestas = apuestas.filter(a => a.usuario !== usuario);
      apuestas.push({ usuario, numero });

      client.publish("ruleta/confirmacion", `${usuario}: apuesta recibida (${numero})`);
      console.log(`📥 ${usuario} apostó al ${numero}`);
    } catch (err) {
      console.error("❌ Error procesando apuesta:", err);
    }
  }

  if (topic === "ruleta/numeroGanador") {
    try {
      const { numeroGanador } = JSON.parse(payload);
      console.log(`🎯 Procesando resultados para número ganador: ${numeroGanador}`);

      apuestas.forEach(({ usuario, numero }) => {
        const gano = parseInt(numero) === numeroGanador;
        const resultado = {
          usuario,
          numeroGanador,
          resultado: gano ? "ganaste" : "perdiste"
        };
        client.publish(`ruleta/resultado/${usuario}`, JSON.stringify(resultado));
      });

      apuestas = [];
    } catch (err) {
      console.error("❌ Error procesando número ganador:", err);
    }
  }
});
