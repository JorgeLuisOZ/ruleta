const client = mqtt.connect("ws://localhost:9001"); // cambia si usas dominio o IP pública

const usuarioInput = document.getElementById("usuario");
const numeroInput = document.getElementById("numero");
const mensajeInput = document.getElementById("mensaje");
const confirmaciones = document.getElementById("confirmaciones");
const estado = document.getElementById("estado");
const resultado = document.getElementById("resultado");
const mensajesDiv = document.getElementById("mensajes");

let usuario = "";

// Conexión al broker
client.on("connect", () => {
  console.log("✅ Conectado al broker MQTT");

  client.subscribe("ruleta/estado");
  client.subscribe("ruleta/confirmacion");
  client.subscribe("ruleta/mensaje");

  // Esperar que el usuario escriba su nombre
  document.getElementById("usuario").addEventListener("change", () => {
    usuario = usuarioInput.value.trim();
    if (usuario) {
      client.subscribe(`ruleta/resultado/${usuario}`);
      client.publish("ruleta/jugadores", usuario);
    }
  });
});

// Manejo de mensajes entrantes
client.on("message", (topic, message) => {
  const payload = message.toString();

  if (topic === "ruleta/estado") {
    estado.textContent = "⏳ Estado: " + payload;
  }

  else if (topic === "ruleta/confirmacion") {
    if (payload.startsWith(usuario)) {
      confirmaciones.textContent = "✅ " + payload;
    }
  }

  else if (topic.startsWith("ruleta/resultado/")) {
    const datos = JSON.parse(payload);
    resultado.textContent = `🎯 Número ganador: ${datos.numeroGanador} → ${datos.resultado.toUpperCase()}`;
  }

  else if (topic === "ruleta/mensaje") {
    const p = document.createElement("p");
    p.textContent = payload;
    mensajesDiv.appendChild(p);
    mensajesDiv.scrollTop = mensajesDiv.scrollHeight;
  }
});

// Función para enviar apuesta
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

// Función para enviar mensaje de chat
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
