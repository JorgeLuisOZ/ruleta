const usuarioInput = document.getElementById("usuario");
const numeroInput = document.getElementById("numero");
const mensajeInput = document.getElementById("mensaje");
const confirmaciones = document.getElementById("confirmaciones");
const estado = document.getElementById("estado");
const resultado = document.getElementById("resultado");
const mensajesDiv = document.getElementById("mensajes");

let client;            // Cliente MQTT
let temporizadorID;    // ID del temporizador de cuenta regresiva

function iniciarMQTT(usuario) {
  if (client && client.connected) return; // Evitar doble conexión

  client = mqtt.connect("ws://localhost:9001");

  client.on("connect", () => {
    console.log("✅ Conectado al broker MQTT");

    client.subscribe("ruleta/estado");
    client.subscribe("ruleta/confirmacion");
    client.subscribe("ruleta/chat");
    client.subscribe(`ruleta/resultado/${usuario}`);

    client.publish("ruleta/jugadores", usuario);
  });

  client.on("message", (topic, message) => {
    const payload = message.toString();

    if (topic === "ruleta/estado") {
      try {
        const datos = JSON.parse(payload);

        if (datos.mensaje === "Ronda activa") {
          const tiempoRestante = () => {
            const ahora = Date.now();
            const msRestantes = datos.inicio + datos.duracion - ahora;
            return Math.max(0, Math.floor(msRestantes / 1000));
          };

          clearInterval(temporizadorID); // Limpiamos anteriores

          let segundos = tiempoRestante();
          estado.textContent = `⏳ Estado: Ronda activa - faltan ${segundos}s`;

          temporizadorID = setInterval(() => {
            segundos = tiempoRestante();
            estado.textContent = `⏳ Estado: Ronda activa - faltan ${segundos}s`;

            if (segundos <= 0) clearInterval(temporizadorID);
          }, 1000);

        } else {
          estado.textContent = `📢 Estado: ${datos.mensaje}`;
        }

      } catch (e) {
        // Mensaje simple o antiguo
        estado.textContent = "⏳ Estado: " + payload;
      }
    } else if (topic === "ruleta/confirmacion") {
      if (payload.startsWith(usuario)) {
        confirmaciones.textContent = "✅ " + payload;
      }
    } else if (topic.startsWith("ruleta/resultado/")) {
      try {
        const datos = JSON.parse(payload);
        const ganador = datos.numeroGanador;
        const resultadoTexto = datos.resultado?.toUpperCase() || "RESULTADO DESCONOCIDO";

        if (!isNaN(ganador)) {
          resultado.textContent = `🎯 Número ganador: ${ganador} → ${resultadoTexto}`;
        } else {
          resultado.textContent = `⚠️ Resultado inválido`;
        }
      } catch (e) {
        resultado.textContent = `❌ Error al recibir resultado`;
        console.error("Error al procesar resultado:", e);
      }
    } else if (topic === "ruleta/chat") {
      const p = document.createElement("p");
      p.textContent = payload;
      mensajesDiv.appendChild(p);
      mensajesDiv.scrollTop = mensajesDiv.scrollHeight;
    }
  });

  // Cuando se cierre la pestaña, desconectamos el cliente
  window.addEventListener("beforeunload", () => {
    if (client && client.connected) {
      client.end(); // Cierra la conexión MQTT
    }
    clearInterval(temporizadorID); // Limpia temporizador si está activo
  });
}

function apostar() {
  const nombre = usuarioInput.value.trim();
  const numero = numeroInput.value.trim();

  if (!nombre || numero === "") {
    alert("Escribe tu nombre y número antes de apostar.");
    return;
  }

  const apuesta = {
    usuario: nombre,
    numero: parseInt(numero)
  };

  client.publish("ruleta/apuestas", JSON.stringify(apuesta));
}

function enviarMensaje() {
  const texto = mensajeInput.value.trim();
  const usuario = usuarioInput.value.trim();

  if (!texto || !usuario) return;

  const msg = {
    usuario,
    texto
  };

  client.publish("ruleta/mensaje", JSON.stringify(msg));
  mensajeInput.value = "";
}
