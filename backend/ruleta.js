const express = require("express");
const path = require("path");
const mqtt = require("mqtt");

const app = express();
const PORT = 3000;

// Servir carpeta frontend como estática
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
// Conexión MQTT
// ============================

const client = mqtt.connect("mqtt://broker-mqtt");

let apuestas = [];
let jugadores = new Set();
let estado = "esperando";
let rondaActiva = false;
let timeoutRonda = null;

client.on("connect", () => {
  console.log("✅ Conectado al broker MQTT");
  client.subscribe("ruleta/apuestas");
  client.subscribe("ruleta/jugadores");
  client.subscribe("ruleta/mensaje");

  client.publish("ruleta/estado", "esperando jugadores...", { retain: true });
});

function iniciarRonda() {
  if (rondaActiva) return;

  rondaActiva = true;
  const timestamp = Date.now(); // tiempo actual en ms
  const estadoRonda = {
    mensaje: "Ronda activa",
    inicio: timestamp,
    duracion: 15000
  };
  client.publish("ruleta/estado", JSON.stringify(estadoRonda), { retain: true });

  timeoutRonda = setTimeout(() => {
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

    // Reset de ronda
    apuestas = [];
    rondaActiva = false;
    client.publish("ruleta/estado", JSON.stringify({ mensaje: "Ronda terminada" }), { retain: true });

  }, 15000);
}

client.on("message", (topic, message) => {
  const payload = message.toString();

  if (topic === "ruleta/apuestas") {
    try {
      const { usuario, numero } = JSON.parse(payload);
      apuestas = apuestas.filter(a => a.usuario !== usuario);
      apuestas.push({ usuario, numero });
      client.publish("ruleta/confirmacion", `${usuario}: apuesta recibida (${numero})`);
      console.log(`✔️ Apuesta de ${usuario} al ${numero}`);
      iniciarRonda();
    } catch (e) {
      console.error("❌ Apuesta inválida", e);
    }

  } else if (topic === "ruleta/jugadores") {
    try {
      const data = JSON.parse(payload);
      const usuario = data.usuario?.trim();
      const origen = data.origen;

      if (!usuario) return;

      const yaExiste = jugadores.has(usuario);

      if (origen === "login") {
        if (yaExiste) {
          // 🔴 Rechazar duplicado
          client.publish(`ruleta/validacion/${usuario}`, JSON.stringify({ valido: false }));
          console.log(`❌ Rechazo desde login: nombre duplicado 👤${usuario}`);
          return;
        } else {
          jugadores.add(usuario);
          client.publish(`ruleta/validacion/${usuario}`, JSON.stringify({ valido: true }));
          console.log(`🟢 Registro desde login: 👤${usuario}`);
          client.publish("ruleta/jugadores", JSON.stringify(Array.from(jugadores)));
        }
      } else if (origen === "ruleta") {
        // Solo se publica si el jugador ya está en la lista
        if (yaExiste) {
          console.log(`🎲 Conexión activa en ruleta: 👤${usuario}`);
        }
      }

    } catch (e) {
      console.error("❌ Error al agregar jugador", e);
    }
  } else if (topic === "ruleta/mensaje") {
    try {
      const { usuario, texto } = JSON.parse(payload);
      const chat = `${usuario}: ${texto}`;
      client.publish("ruleta/chat", chat);
      console.log(`💬 ${chat}`);
    } catch (e) {
      console.error("❌ Error en mensaje de chat", e);
    }

  } else {
    // Este else evita que se impriman cosas como los ////// infinitos
    if (!topic.startsWith("ruleta/jugadores")) {
      console.warn(`⚠️ Mensaje no manejado. Topic: "${topic}", Payload: "${payload}"`);
    }
  }
});
