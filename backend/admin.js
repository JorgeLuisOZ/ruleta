const mqtt = require("mqtt");
const client = mqtt.connect("mqtt://broker-mqtt");

let apuestas = [];
let jugadores = new Set();
let rondaActiva = false;
let estadoActual = { mensaje: "esperando apuestas de los jugadores..." };
let ultimoNumeroGanador = null;

client.on("connect", () => {
  console.log("🤖 Admin conectado al broker MQTT");

  client.subscribe("ruleta/apuestas");
  client.subscribe("ruleta/jugadores");
  client.subscribe("ruleta/numeroGanador");

  client.publish("ruleta/estado", JSON.stringify(estadoActual), { retain: true });
});

function iniciarRonda() {
  if (rondaActiva) return;
  rondaActiva = true;

  const timestamp = Date.now();

  estadoActual = {
    mensaje: "Ronda activa",
    inicio: timestamp,
    duracion: 15000
  };
  client.publish("ruleta/estado", JSON.stringify(estadoActual), { retain: true });

  setTimeout(() => {
    const anguloRuleta = Math.floor((5 + Math.random() * 2) * 360);
    const anguloBola = Math.floor((5 + Math.random() * 2) * 360);

    estadoActual = {
      mensaje: "Girando",
      anguloRuleta,
      anguloBola
    };
    client.publish("ruleta/estado", JSON.stringify(estadoActual), { retain: true });

    setTimeout(() => {
        if (ultimoNumeroGanador === null) {
            console.error("❌ No se recibió número ganador a tiempo.");
            return;
        }

        const numeroGanador = ultimoNumeroGanador;
        console.log(`🎯 Número ganador: ${numeroGanador}`);

        // Publicar al canal ruleta/ganador
        client.publish("ruleta/ganador", JSON.stringify({ numeroGanador }), { retain: true });

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
        rondaActiva = false;
        estadoActual = { mensaje: "Ronda terminada" };
        client.publish("ruleta/estado", JSON.stringify(estadoActual), { retain: true });

        // Limpiar el valor guardado
        ultimoNumeroGanador = null;
        }, 5000);
  }, 15000);
}

client.on("message", (topic, message) => {
  const payload = message.toString();

  if (topic === "ruleta/apuestas") {
    try {
      const { usuario, numero } = JSON.parse(payload);
      if (!usuario || isNaN(parseInt(numero))) return;

      if (estadoActual.mensaje === "esperando apuestas de los jugadores..." || estadoActual.mensaje === "Ronda activa") {
        apuestas = apuestas.filter(a => a.usuario !== usuario);
        apuestas.push({ usuario, numero });

        client.publish("ruleta/confirmacion", `${usuario}: apuesta recibida (${numero})`);
        console.log(`📥 ${usuario} apostó al ${numero}`);

        if (!rondaActiva) iniciarRonda();
      } else {
        console.log(`⚠️ Apuesta rechazada de ${usuario}, fuera de tiempo`);
      }
    } catch (err) {
      console.error("❌ Error procesando apuesta:", err);
    }
  }

  if (topic === "ruleta/jugadores") {
    try {
      const { usuario } = JSON.parse(payload);
      if (usuario && !jugadores.has(usuario)) jugadores.add(usuario);

      console.log(`👤 Jugador conectado: ${usuario}`);
      client.publish("ruleta/estado", JSON.stringify(estadoActual));
    } catch (e) {
      console.error("❌ Error al procesar jugador:", e);
    }
  }

  if (topic === "ruleta/numeroGanador") {
    try {
        const { numeroGanador } = JSON.parse(payload);
        ultimoNumeroGanador = numeroGanador; 
    } catch (err) {
        console.error("❌ Error al procesar número ganador:", err);
    }
    }
});
