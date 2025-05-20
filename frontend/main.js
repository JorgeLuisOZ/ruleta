const numeroInput = document.getElementById("numero");
const mensajeInput = document.getElementById("mensaje");
const confirmaciones = document.getElementById("confirmaciones");
const estado = document.getElementById("estado");
const resultado = document.getElementById("resultado");
const mensajesDiv = document.getElementById("mensajes");

const usuario = localStorage.getItem("usuarioRuleta");
document.getElementById("usuario").textContent = usuario;

let client;
let temporizadorID;

function iniciarMQTT() {
  if (!usuario) {
    alert("No se ha definido un usuario. Vuelve al login.");
    return;
  }

  if (client && client.connected) return;

  client = mqtt.connect("ws://" + window.location.hostname + ":9001");

  client.on("connect", () => {
    console.log("✅ Conectado al broker MQTT como", usuario);

    client.subscribe("ruleta/estado");
    client.subscribe("ruleta/confirmacion");
    client.subscribe("ruleta/chat");
    client.subscribe(`ruleta/resultado/${usuario}`);

    client.publish("ruleta/jugadores", JSON.stringify({ usuario, origen: "ruleta" }));

  });

  client.on("message", (topic, message) => {
    const payload = message.toString();

    if (topic === "ruleta/estado") {
      try {
        const datos = JSON.parse(payload);

        if (datos.mensaje === "Ronda activa") {
          const ruleta = document.getElementById("ruleta");
          const angulo = 3600 + Math.floor(Math.random() * 1800);
          ruleta.style.transition = "transform 5s ease-out";
          ruleta.style.transform = `rotate(${angulo}deg)`;

          const tiempoRestante = () => {
            const ahora = Date.now();
            const msRestantes = datos.inicio + datos.duracion - ahora;
            return Math.max(0, Math.floor(msRestantes / 1000));
          };

          clearInterval(temporizadorID);
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

  window.addEventListener("beforeunload", () => {
    if (client && client.connected) client.end();
    clearInterval(temporizadorID);
  });
}

function apostar() {
  const numero = numeroInput.value.trim();

  if (!usuario || numero === "") {
    alert("Escribe tu número antes de apostar.");
    return;
  }

  const apuesta = {
    usuario,
    numero: parseInt(numero)
  };

  client.publish("ruleta/apuestas", JSON.stringify(apuesta));
}

function enviarMensaje() {
  const texto = mensajeInput.value.trim();
  if (!texto || !usuario) return;

  const msg = {
    usuario,
    texto
  };

  client.publish("ruleta/mensaje", JSON.stringify(msg));
  mensajeInput.value = "";
}

// ✅ Inicializamos automáticamente
document.addEventListener("DOMContentLoaded", iniciarMQTT);
