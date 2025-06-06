// 🎯 Referencias a elementos del DOM para mostrar información en pantalla
const numeroInput = document.getElementById("numero");
const mensajeInput = document.querySelector(".chat-input input");
const confirmaciones = document.getElementById("mensaje-confirmaciones");
const estado = document.getElementById("estado");
const mensajesDiv = document.getElementById("mensajes");
const apuestaTotalSpan = document.getElementById("apuesta");
const saldoSpan = document.getElementById("saldo");
const mensajeSuperior = document.getElementById("mensaje-superior");

// 👤 Datos del usuario actual
const usuario = sessionStorage.getItem("usuarioRuleta");
document.getElementById("usuario").textContent = usuario;

// ⚙️ Variables de estado de la aplicación
let client; // conexión MQTT
let temporizadorID; // ID del temporizador de la cuenta regresiva
let fichaSeleccionada = 0; // valor de la ficha actual
let puedeApostar = false; // indica si el usuario puede apostar
let anguloOrbita = 0; // ángulo acumulado de la bola

// 💰 Control del saldo del usuario
const claveSaldo = `saldoRuleta_${usuario}`;
let saldo = parseInt(sessionStorage.getItem(claveSaldo));
if (isNaN(saldo)) saldo = 5000;

// 💸 Apuestas realizadas
let apuestaTotal = 0;
let historialApuestas = [];

// 🌀 Datos de la ruleta
const numerosRuleta = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
  6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
  29, 7, 28, 12, 35, 3, 26]; // orden europeo

const offset = 355; // desfase angular para alinear visualmente
const sectoresBase = []; // sectores con ángulos de cada número
const totalNumeros = numerosRuleta.length;
const anguloSector = 360 / totalNumeros;

// 🔁 Estado de la animación
let numeroGanadorPendiente = null; 

// Resultado por usuario
let resultadoPendiente = null;

// 🧮 Construcción de los sectores circulares de la ruleta
for (let i = 0; i < totalNumeros; i++) {
  let desde = (offset + i * anguloSector) % 360;
  let hasta = (offset + (i + 1) * anguloSector) % 360;
  sectoresBase.push({ numero: numerosRuleta[i], desde, hasta });
}

function actualizarSaldoUI() {
  saldoSpan.textContent = `$${saldo.toLocaleString()}`;
  sessionStorage.setItem(claveSaldo, saldo);
}

function actualizarApuestaUI() {
  apuestaTotalSpan.textContent = `$${apuestaTotal.toLocaleString()}`;
}

// Modal para mostrar si el usuario gano y cuanto gano
function mostrarModalGanancia(montoGanado) {
    const modal = document.getElementById("modalGanancia");
    const mensaje = document.getElementById("mensajeGanancia");
    mensaje.textContent = `Ganaste $${montoGanado.toLocaleString()}`;
    modal.classList.remove("oculto");
  }

function ocultarModalGanancia() {
  document.getElementById("modalGanancia").classList.add("oculto");
}

function iniciarMQTT() {
  if (!usuario) {
    alert("No se ha definido un usuario. Vuelve al login.");
    return;
  }

  actualizarSaldoUI();
  actualizarApuestaUI();

  const clientId = "clienteRuleta_" + Math.random().toString(16).slice(2);
  client = new Paho.MQTT.Client(window.location.hostname, 9001, clientId);

  client.onConnectionLost = (responseObject) => {
    console.error("❌ MQTT desconectado:", responseObject);
    if (responseObject.errorCode !== 0) {
      console.error("🔎 Código:", responseObject.errorCode);
      console.error("🔎 Mensaje:", responseObject.errorMessage);
    }
  };

  client.onMessageArrived = (message) => {
    const topic = message.destinationName;
    const payload = message.payloadString;

    if (topic === "ruleta/estado") {
      try {
        const datos = JSON.parse(payload);
        const ahora = Date.now();

        if (datos.mensaje === "Ronda activa" && datos.inicio && datos.duracion) {
          puedeApostar = true;

          const msRestantes = datos.inicio + datos.duracion - ahora;
          clearInterval(temporizadorID);

          let segundos = Math.max(1, Math.floor(msRestantes / 1000));
          mensajeSuperior.textContent = `⏳ Estado: Ronda activa - faltan ${segundos}s`;

          temporizadorID = setInterval(() => {
            segundos--;
            mensajeSuperior.textContent = `⏳ Estado: Ronda activa - faltan ${segundos}s`;

            if (segundos <= 0) {
              clearInterval(temporizadorID);
              puedeApostar = false;

              // 📤 Publicar apuestas acumuladas al finalizar la cuenta regresiva
              historialApuestas.forEach(({ celda, monto, numero }) => {
                let texto = numero;

                if (!texto && celda) {
                  const className = celda.className;
                  const contenido = celda.innerText.trim().toLowerCase();

                  // 🎯 Detección de "2to1" por fila
                  if (className.includes("apuesta") && className.includes("fila")) {
                    if (className.includes("uno")) {
                      texto = "2to1 (columna 1)";
                    } else if (className.includes("dos")) {
                      texto = "2to1 (columna 2)";
                    } else if (className.includes("tres")) {
                      texto = "2to1 (columna 3)";
                    }
                  } else if (className.includes("apuesta doble rojo")) {
                    texto = "Rojo";
                  } else if (className.includes("apuesta doble negro")) {
                    texto = "Negro";
                  } else if (className.includes("apuesta doble") && contenido.includes("par")) {
                    texto = "Par";
                  } else if (className.includes("apuesta doble") && contenido.includes("impar")) {
                    texto = "Impar";
                  } else if (className.includes("apuesta doble") && (contenido.includes("1–18") || contenido.includes("1-18"))) {
                    texto = "1–18";
                  } else if (className.includes("apuesta doble") && (contenido.includes("19–36") || contenido.includes("19-36"))) {
                    texto = "19–36";
                  } else if (contenido !== "") {
                    texto = celda.innerText.trim();
                  } else {
                    return; // ⚠️ No se pudo determinar la apuesta, se omite
                  }
                }

                const msg = new Paho.MQTT.Message(JSON.stringify({
                  usuario,
                  numero: texto,
                  monto
                }));
                msg.destinationName = "ruleta/apuestas";
                client.send(msg);

                console.log(`📤 apuesta: $${monto} al ${texto}`);
              });
            }
          }, 1000);
        } else if (datos.mensaje === "Girando") {
          puedeApostar = false;
          mensajeSuperior.textContent = "🎰 Girando...";
        } else if (datos.mensaje === "Ronda terminada") {
          puedeApostar = false;

          // 🧽 Limpiar todas las fichas visuales del tablero
          document.querySelectorAll(".ficha-apuesta").forEach(ficha => ficha.remove());

          // 🔁 Reiniciar el historial y totales
          historialApuestas = [];
          apuestaTotal = 0;
          actualizarApuestaUI();

          if (numeroGanadorPendiente !== null) {
            mensajeSuperior.textContent = `🎯 Número ganador: ${numeroGanadorPendiente}`;

            // ✅ Mostrar ganancia si hay resultado pendiente
            if (resultadoPendiente) {
              const { montoGanado } = resultadoPendiente;
              if (montoGanado > 0) {
                saldo += montoGanado;
                actualizarSaldoUI();
                mostrarModalGanancia(montoGanado);
              } else {
                console.log("⛔ No hubo ganancia.");
              }
              resultadoPendiente = null; // Limpiar para siguiente ronda
            }

            setTimeout(() => {
              mensajeSuperior.textContent = "⌛ Esperando próxima ronda...";
              numeroGanadorPendiente = null;
            }, 3000); // ⏱️ Mostrar por 3 segundos
          } else {
            mensajeSuperior.textContent = "⌛ Esperando próxima ronda...";
          }
        }
      } catch (e) {
        console.error("Error en ruleta/estado:", e);
        mensajeSuperior.textContent = "⏳ Estado: " + payload;
      }
    } if (topic === "ruleta/confirmacion") {
      if (payload.startsWith(usuario)) {
        confirmaciones.textContent = "✅ " + payload;

        confirmaciones.style.display = "block";

        clearTimeout(confirmaciones._timeoutId);
        confirmaciones._timeoutId = setTimeout(() => {
          confirmaciones.style.display = "none";
          confirmaciones.textContent = "";
        }, 6000);
      }
    } else if (topic === "ruleta/numeroGanador") {
      try {
        const { numeroGanador } = JSON.parse(payload);
        numeroGanadorPendiente = numeroGanador;

        anguloOrbita = 0;

        const orbita = document.getElementById("orbita-bola");
        const sector = sectoresBase.find(s => s.numero === numeroGanadorPendiente);
        if (!sector) return;

        const centroSector = (sector.desde + sector.hasta) / 2;

        const vueltasBola = Math.floor(5 + Math.random() * 5);
        const extra = vueltasBola * 360;

        const anguloBolaRelativo = (360 - centroSector) % 360;
        anguloOrbita -= extra + anguloBolaRelativo;

        orbita.style.transition = "transform 4s ease-out";
        orbita.style.transform = `rotate(${anguloOrbita}deg)`;

        console.log("🎯 Bola gira hacia el número", numeroGanadorPendiente, "con", vueltasBola, "vueltas extra → Ángulo:", anguloOrbita.toFixed(2));

      } catch (e) {
        console.error("❌ Error al animar bola con número ganador:", e);
      }
    } else if (topic === "ruleta/resultado/" + usuario) {
      try {
        resultadoPendiente = JSON.parse(payload); 
        console.log("📦 Resultado recibido (esperando mostrar):", resultadoPendiente);
      } catch (e) {
        console.error("❌ Error procesando resultado de ruleta:", e);
      }
    } else if (topic === "ruleta/chat") {
      try {
        const datos = JSON.parse(payload);
        const p = document.createElement("p");
        p.textContent = datos.texto;
        mensajesDiv.appendChild(p);
        mensajesDiv.scrollTop = mensajesDiv.scrollHeight;
      } catch (e) {
        console.error("❌ Error mostrando mensaje de chat:", e);
      }

    } 
  };

  client.connect({
    onSuccess: () => {
      console.log("✅ Conectado al broker MQTT como", usuario);

      const topics = [
        "ruleta/estado",
        "ruleta/confirmacion",
        "ruleta/chat",
        "ruleta/numeroGanador",
        "ruleta/resultado/" + usuario
      ];

      topics.forEach(t => client.subscribe(t));

      setTimeout(() => {
        const msg = new Paho.MQTT.Message(JSON.stringify({ usuario, origen: "ruleta" }));
        msg.destinationName = "ruleta/jugadores";
        client.send(msg);
      }, 1000);
    },
    useSSL: false
  });

  window.addEventListener("beforeunload", () => {
    if (client && client.isConnected()) client.disconnect();
    clearInterval(temporizadorID);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  iniciarMQTT();

  // Selección de fichas
  document.querySelectorAll(".ficha").forEach(ficha => {
    ficha.addEventListener("click", () => {
      document.querySelectorAll(".ficha").forEach(f => f.classList.remove("seleccionada"));
      ficha.classList.add("seleccionada");

      if (ficha.classList.contains("ficha1")) fichaSeleccionada = 1;
      else if (ficha.classList.contains("ficha5")) fichaSeleccionada = 5;
      else if (ficha.classList.contains("ficha20")) fichaSeleccionada = 20;
      else if (ficha.classList.contains("ficha50")) fichaSeleccionada = 50;
      else if (ficha.classList.contains("ficha100")) fichaSeleccionada = 100;
      else if (ficha.classList.contains("ficha500")) fichaSeleccionada = 500;
      else if (ficha.classList.contains("ficha1k")) fichaSeleccionada = 1000;

      console.log("Ficha seleccionada: $" + fichaSeleccionada);
    });
  });

  document.querySelectorAll(".celda").forEach(celda => {
    celda.addEventListener("click", () => {
      if (!puedeApostar) {
        alert("⛔ No se puede apostar en este momento.");
        return;
      }

      if (!fichaSeleccionada) {
        alert("Selecciona una ficha primero.");
        return;
      }

      let texto = celda.textContent.trim();

      // ✅ Identificación especial para casillas 2to1
      if (celda.classList.contains("apuesta") && celda.classList.contains("fila")) {
        if (celda.classList.contains("uno")) texto = "2to1 (columna 1)";
        else if (celda.classList.contains("dos")) texto = "2to1 (columna 2)";
        else if (celda.classList.contains("tres")) texto = "2to1 (columna 3)";
        else texto = "2to1";
      }

      // ✅ Para colores sin texto
      if (!texto) {
        if (celda.classList.contains("rojo")) texto = "Rojo";
        else if (celda.classList.contains("negro")) texto = "Negro";
        else return alert("Casilla no válida para apuesta.");
      }

      if (fichaSeleccionada > saldo) {
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }

      // Guardar en historial
      historialApuestas.push({ celda, monto: fichaSeleccionada, numero: texto });

      saldo -= fichaSeleccionada;
      apuestaTotal += fichaSeleccionada;
      actualizarSaldoUI();
      actualizarApuestaUI();

      // Mostrar ficha visual acumulada
      let fichaVisual = Array.from(celda.children).find(child =>
        child.classList.contains("ficha-apuesta")
      );

      if (fichaVisual) {
        const actual = parseInt(fichaVisual.textContent.replace('$', ''));
        fichaVisual.textContent = `$${actual + fichaSeleccionada}`;
      } else {
        fichaVisual = document.createElement("div");
        fichaVisual.classList.add("ficha-apuesta");
        fichaVisual.textContent = `$${fichaSeleccionada}`;
        celda.appendChild(fichaVisual);
      }
    });
  });

  document.querySelector(".boton-control.regresar").addEventListener("click", () => {
    const ultima = historialApuestas.pop();
    if (!ultima) return;

    const { celda, monto } = ultima;
    const ficha = celda.querySelector(".ficha-apuesta");
    if (!ficha) return;

    const actual = parseInt(ficha.textContent.replace('$', ''));
    const nuevo = actual - monto;

    if (nuevo <= 0) {
      ficha.remove();
    } else {
      ficha.textContent = `$${nuevo}`;
    }

    saldo += monto;
    apuestaTotal -= monto;
    actualizarSaldoUI();
    actualizarApuestaUI();
  });
  
  document.querySelector(".boton-control.doblar").addEventListener("click", () => {
    if (!puedeApostar) {
      alert("⛔ No se puede apostar en este momento.");
      return;
    }

    if (historialApuestas.length === 0) {
      alert("⛔ No hay apuestas previas para duplicar.");
      return;
    }

    let apuestaDuplicada = 0;

    // Recorrer las apuestas en el historial y duplicarlas (sumar la apuesta existente)
    historialApuestas.forEach(({ celda, monto, numero }, index) => {
      // Sumar el monto de la apuesta al monto actual
      const nuevaApuesta = monto;  // Sumamos el monto actual nuevamente

      // Verificar si el usuario tiene suficiente saldo
      if (nuevaApuesta > saldo) {
        alert("⛔ No tienes suficiente saldo para duplicar la apuesta.");
        return;
      }

      // Actualizar el saldo y la apuesta total
      saldo -= nuevaApuesta;
      apuestaTotal += nuevaApuesta;
      actualizarSaldoUI();
      actualizarApuestaUI();

      // Modificar la ficha visual de la apuesta en el tablero
      let fichaVisual = Array.from(celda.children).find(child =>
        child.classList.contains("ficha-apuesta")
      );

      if (fichaVisual) {
        // Si ya hay una ficha visual, se actualiza sumando la nueva apuesta
        const actual = parseInt(fichaVisual.textContent.replace('$', ''));
        fichaVisual.textContent = `$${actual + nuevaApuesta}`;  // Se suma la apuesta original nuevamente
      } else {
        // Si no hay ficha visual, se crea una nueva con el valor de la nueva apuesta
        fichaVisual = document.createElement("div");
        fichaVisual.classList.add("ficha-apuesta");
        fichaVisual.textContent = `$${nuevaApuesta}`;
        celda.appendChild(fichaVisual);
      }

      // Actualizar el monto de la apuesta en el historial sin eliminarla
      historialApuestas[index].monto += nuevaApuesta;

      // Contabilizar la apuesta duplicada
      apuestaDuplicada += nuevaApuesta;
    });

    // Al finalizar, mostramos el total de las apuestas duplicadas
    console.log(`📦 Apuesta total duplicada: $${apuestaDuplicada}`);
  });

  // Enviar mensaje
  document.querySelector(".chat-input button").addEventListener("click", enviarMensaje);
  mensajeInput.addEventListener("keydown", e => {
    if (e.key === "Enter") enviarMensaje();
  });

  function enviarMensaje() {
    const texto = mensajeInput.value.trim();
    if (!texto || !usuario) return;

    const msgChat = new Paho.MQTT.Message(JSON.stringify({ usuario, texto, origen: "cliente" }));
    msgChat.destinationName = "ruleta/mensajes";
    client.send(msgChat);

    mensajeInput.value = "";
  }

});
