const mqtt = require("mqtt");
const client = mqtt.connect("mqtt://broker-mqtt");

let rondaActiva = false;
let estadoActual = { mensaje: "Esperando apuestas de los jugadores..." };

client.on("connect", () => {
  console.log("🎯 Ruleta conectada al broker MQTT");

  // Publicar estado inicial
  client.publish("ruleta/estado", JSON.stringify(estadoActual), { retain: true });

  // Iniciar bucle automático de rondas cada 30 segundos
  setInterval(() => {
    if (!rondaActiva) iniciarRonda();
  }, 30000); // cada 30 segundos
});

function iniciarRonda() {
  rondaActiva = true;

  const timestamp = Date.now();
  estadoActual = { mensaje: "Ronda activa", inicio: timestamp, duracion: 15000 };
  client.publish("ruleta/estado", JSON.stringify(estadoActual), { retain: true });
  console.log("🟢 Ronda activa iniciada");

  setTimeout(() => {
    estadoActual = { mensaje: "Girando" };
    client.publish("ruleta/estado", JSON.stringify(estadoActual), { retain: true });
    console.log("🔄 Girando...");

    setTimeout(() => {
      const numeroGanador = Math.floor(Math.random() * 37);
      console.log(`🎰 Número ganador: ${numeroGanador}`);

      client.publish("ruleta/numeroGanador", JSON.stringify({ numeroGanador }), { retain: true });

      estadoActual = { mensaje: "Ronda terminada" };
      client.publish("ruleta/estado", JSON.stringify(estadoActual), { retain: true });
      console.log("🔴 Ronda terminada");

      rondaActiva = false;
    }, 8000); // tiempo de giro
  }, 15000); // tiempo de apuestas
}
