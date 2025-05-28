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
      const { usuario, numero, monto } = JSON.parse(payload);
      const validas = [
        "Rojo", "Negro", "Par", "Impar", "1–18", "1-18", "19–36", "19-36",
        "2to1 (columna 1)", "2to1 (columna 2)", "2to1 (columna 3)"
      ];

      // Validación general
      if (!usuario || !numero || isNaN(monto)) return;
      if (isNaN(parseInt(numero)) && !validas.includes(numero)) return;

      // Buscar si ya existe la apuesta al mismo número/sección
      const existente = apuestas.find(a => a.usuario === usuario && a.numero === numero);
      if (existente) {
        existente.monto += monto;
      } else {
        apuestas.push({ usuario, numero, monto });
      }

      // Lista de números/secciones apostadas
      const apuestasUsuarioLista = apuestas
        .filter(a => a.usuario === usuario)
        .map(a => a.numero)
        .join(", ");

      // Total apostado por el usuario
      const totalApostado = apuestas
        .filter(a => a.usuario === usuario)
        .reduce((sum, a) => sum + a.monto, 0);

      // Confirmación para el usuario
      const mensaje = `${usuario}: apuesta recibida (${apuestasUsuarioLista}) - Total apostado: $${totalApostado}`;
      client.publish("ruleta/confirmacion", mensaje);

      // console.log(`📥 ${usuario} apostó a: ${apuestasUsuarioLista} (Total: $${totalApostado})`);
    } catch (err) {
      console.error("❌ Error procesando apuesta:", err);
    }
  }

  if (topic === "ruleta/numeroGanador") {
    try {

      // Mostrar un único resumen por usuario
      const resumenPorUsuario = {};
      apuestas.forEach(({ usuario, numero, monto }) => {
        if (!resumenPorUsuario[usuario]) resumenPorUsuario[usuario] = { total: 0, lista: [] };
        resumenPorUsuario[usuario].total += monto;
        resumenPorUsuario[usuario].lista.push(numero);
      });

      for (const usuario in resumenPorUsuario) {
        const { total, lista } = resumenPorUsuario[usuario];
        const unicos = [...new Set(lista)].join(", ");
        console.log(`📥 ${usuario} apostó a: ${unicos} (Total: $${total})`);
      }

      const { numeroGanador } = JSON.parse(payload);
      console.log(`🎯 Procesando resultados para número ganador: ${numeroGanador}`);

      const rojos = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
      const negros = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
      const columna1 = [1,4,7,10,13,16,19,22,25,28,31,34];
      const columna2 = [2,5,8,11,14,17,20,23,26,29,32,35];
      const columna3 = [3,6,9,12,15,18,21,24,27,30,33,36];

      const resultados = {};

      apuestas.forEach(({ usuario, numero, monto }) => {
        if (!resultados[usuario]) resultados[usuario] = { montoGanado: 0 };

        const num = parseInt(numero);
        if (!isNaN(num) && num === numeroGanador) {
          resultados[usuario].montoGanado += monto * 36;
          return;
        }

        if (numero === "Rojo" && rojos.includes(numeroGanador)) {
          resultados[usuario].montoGanado += monto * 2;
        } else if (numero === "Negro" && negros.includes(numeroGanador)) {
          resultados[usuario].montoGanado += monto * 2;
        } else if (numero === "Par" && numeroGanador !== 0 && numeroGanador % 2 === 0) {
          resultados[usuario].montoGanado += monto * 2;
        } else if (numero === "Impar" && numeroGanador % 2 === 1) {
          resultados[usuario].montoGanado += monto * 2;
        } else if ((numero === "1–18" || numero === "1-18") && numeroGanador >= 1 && numeroGanador <= 18) {
          resultados[usuario].montoGanado += monto * 2;
        } else if ((numero === "19–36" || numero === "19-36") && numeroGanador >= 19 && numeroGanador <= 36) {
          resultados[usuario].montoGanado += monto * 2;
        } else if (numero === "2to1 (columna 1)" && columna1.includes(numeroGanador)) {
          resultados[usuario].montoGanado += monto * 3;
        } else if (numero === "2to1 (columna 2)" && columna2.includes(numeroGanador)) {
          resultados[usuario].montoGanado += monto * 3;
        } else if (numero === "2to1 (columna 3)" && columna3.includes(numeroGanador)) {
          resultados[usuario].montoGanado += monto * 3;
        }
      });

      // Publicar resultados por usuario
      for (const usuario in resultados) {
        const { montoGanado } = resultados[usuario];
        const resultado = {
          usuario,
          numeroGanador,
          resultado: montoGanado > 0 ? "Gano" : "Perdio",
          montoGanado
        };
        client.publish(`ruleta/resultado/${usuario}`, JSON.stringify(resultado));
        console.log(`🏆 Resultado para ${usuario}: ${resultado.resultado} - Ganó $${montoGanado}`);
      }

      apuestas = [];
    } catch (err) {
      console.error("❌ Error procesando número ganador:", err);
    }
  }
});
