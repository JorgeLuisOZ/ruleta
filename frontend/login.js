let clientMQTT;

function iniciarSesion() {
  const nombre = document.getElementById('usuario').value.trim();
  if (!nombre) {
    alert('Por favor, ingresa tu nombre.');
    return;
  }

  if (!clientMQTT || !clientMQTT.isConnected()) {
    alert('Conexión MQTT no disponible todavía. Intenta de nuevo.');
    return;
  }

  // Guardamos nombre temporalmente
  sessionStorage.setItem("tempUsuarioRuleta", nombre);

  // Suscribirse a tópico de validación
  const topicRespuesta = `ruleta/validacion/${nombre}`;
  clientMQTT.subscribe(topicRespuesta);

  // Enviar solicitud de validación
  const mensaje = new Paho.MQTT.Message(JSON.stringify({
    usuario: nombre,
    origen: "login"
  }));
  mensaje.destinationName = "ruleta/jugadores";
  clientMQTT.send(mensaje);
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('usuario');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') iniciarSesion();
  });

  // Crear cliente Paho
  const clientId = "clienteLogin_" + Math.random().toString(16).substr(2, 8);
  clientMQTT = new Paho.MQTT.Client(window.location.hostname, 9001, clientId);

  // Asignar callbacks
  clientMQTT.onConnectionLost = function (responseObject) {
    if (responseObject.errorCode !== 0) {
      console.error("❌ Conexión perdida:", responseObject.errorMessage);
    }
  };

  clientMQTT.onMessageArrived = function (message) {
    const actual = sessionStorage.getItem("tempUsuarioRuleta");
    const expectedTopic = `ruleta/validacion/${actual}`;

    if (message.destinationName === expectedTopic) {
      try {
        const datos = JSON.parse(message.payloadString);
        if (datos.valido) {
          sessionStorage.setItem("usuarioRuleta", actual);
          window.location.href = "ruleta.html";
        } else {
          alert("❌ Ese nombre ya está en uso. Elige otro.");
        }
      } catch (e) {
        console.error("❌ Error al procesar validación:", e);
      }
    }
  };

  // Conectar al broker
  clientMQTT.connect({
    onSuccess: function () {
      console.log("✅ Conectado al broker desde login (Paho)");
    },
    useSSL: false // true si usas HTTPS y tienes wss://
  });
});
