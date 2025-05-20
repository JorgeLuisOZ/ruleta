let clientMQTT;

function iniciarSesion() {
  const nombre = document.getElementById('usuario').value.trim();
  if (!nombre) {
    alert('Por favor, ingresa tu nombre.');
    return;
  }

  if (!clientMQTT || !clientMQTT.connected) {
    alert('Conexión MQTT no disponible todavía. Intenta de nuevo.');
    return;
  }

  // Guardamos nombre en localStorage para usar en ruleta.html
  localStorage.setItem("tempUsuarioRuleta", nombre);

  // Nos suscribimos al canal de validación específico
  const topicRespuesta = `ruleta/validacion/${nombre}`;
  clientMQTT.subscribe(topicRespuesta);

  // Publicamos solicitud al backend indicando que es desde login
  clientMQTT.publish("ruleta/jugadores", JSON.stringify({
    usuario: nombre,
    origen: "login"
  }));
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('usuario');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') iniciarSesion();
  });

  clientMQTT = mqtt.connect("ws://" + window.location.hostname + ":9001");

  clientMQTT.on("connect", () => {
    console.log("✅ Conectado al broker desde login");
  });

  clientMQTT.on("message", (topic, message) => {
    const actual = localStorage.getItem("tempUsuarioRuleta");
    const expectedTopic = `ruleta/validacion/${actual}`;

    if (topic === expectedTopic) {
      try {
        const datos = JSON.parse(message.toString());
        if (datos.valido) {
          localStorage.setItem("usuarioRuleta", actual);
          window.location.href = "ruleta.html";
        } else {
          alert("❌ Ese nombre ya está en uso. Elige otro.");
        }
      } catch (e) {
        console.error("❌ Error al procesar validación:", e);
      }
    }
  });
});
