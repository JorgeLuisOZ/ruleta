// backend/ruleta.js

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, '../frontend')));

app.listen(PORT, () => {
  console.log(`🟢 Servidor frontend en http://localhost:${PORT}`);
});


const mqtt = require("mqtt");
const client = mqtt.connect("mqtt://broker-mqtt");

let apuestas = [];
let jugadores = new Set();
let estado = "esperando";

client.on("connect", () => {
  console.log("Conectado al broker MQTT");
  client.subscribe("ruleta/apuestas");
  client.subscribe("ruleta/jugadores");
  client.subscribe("ruleta/mensaje");

  client.publish("ruleta/estado", "esperando jugadores...");

  setInterval(() => {
    if (apuestas.length === 0) return;

    estado = "girando";
    client.publish("ruleta/estado", "Girando ruleta...");

    const ganador = Math.floor(Math.random() * 37);
    console.log(`\n🎯 Número ganador: ${ganador}`);
    client.publish("ruleta/ganador", ganador.toString());

    apuestas.forEach(({ usuario, numero }) => {
      const gano = parseInt(numero) === ganador;
      const mensaje = {
        usuario,
        resultado: gano ? "ganaste" : "perdiste",
        numeroGanador: ganador,
      };
      client.publish(`ruleta/resultado/${usuario}`, JSON.stringify(mensaje));
    });

    apuestas = [];
    estado = "esperando";
    client.publish("ruleta/estado", "Nueva ronda: esperando apuestas");
  }, 15000);
});

client.on("message", (topic, message) => {
  const payload = message.toString();

  if (topic === "ruleta/apuestas") {
    try {
      const { usuario, numero } = JSON.parse(payload);
      apuestas = apuestas.filter(a => a.usuario !== usuario);
      apuestas.push({ usuario, numero });
      client.publish("ruleta/confirmacion", `${usuario}: apuesta recibida (${numero})`);
      console.log(`✔️ Apuesta de ${usuario} al ${numero}`);
    } catch (e) {
      console.error("❌ Apuesta inválida", e);
    }
  }

  if (topic === "ruleta/jugadores") {
    try {
      const usuario = payload.trim();
      jugadores.add(usuario);
      const lista = Array.from(jugadores);
      client.publish("ruleta/jugadores", JSON.stringify(lista));
      console.log(`👤 Jugador conectado: ${usuario}`);
    } catch (e) {
      console.error("❌ Error al agregar jugador", e);
    }
  }

  if (topic === "ruleta/mensaje") {
    try {
      const { usuario, texto } = JSON.parse(payload);
      const chat = `${usuario}: ${texto}`;
      client.publish("ruleta/mensaje", chat);
      console.log(`💬 ${chat}`);
    } catch (e) {
      console.error("❌ Error en mensaje de chat", e);
    }
  }
});
