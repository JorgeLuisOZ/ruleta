// 🎯 Referencias a elementos del DOM para mostrar información en pantalla
const numeroInput = document.getElementById("numero");
const mensajeInput = document.querySelector(".chat-input input");
const confirmaciones = document.getElementById("confirmaciones");
const estado = document.getElementById("estado");
const resultado = document.getElementById("resultado");
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
let anguloAcumulado = 0; // ángulo actual acumulado de la ruleta
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
let numeroGanadorPendiente = null; // número ganador recibido pero aún no animado
let ruletaGirando = false; // si la ruleta está girando actualmente

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

function actualizarSectores() {
  sectoresBase.length = 0;
  for (let i = 0; i < totalNumeros; i++) {
    let desde = (offset + anguloAcumulado + i * anguloSector) % 360;
    let hasta = (offset + anguloAcumulado + (i + 1) * anguloSector) % 360;
    sectoresBase.push({ numero: numerosRuleta[i], desde, hasta });
  }
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
    if (responseObject.errorCode !== 0) {
      console.error("❌ Conexión perdida:", responseObject.errorMessage);
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
            if (segundos <= 0) clearInterval(temporizadorID);
          }, 1000);
        } else if (datos.mensaje === "Girando") {
          puedeApostar = false;
          mensajeSuperior.textContent = "🎰 Girando...";
        } else if (datos.mensaje === "Ronda terminada") {
          puedeApostar = false;
          mensajeSuperior.textContent = "⌛ Esperando próxima ronda...";
        } else {
          puedeApostar = datos.mensaje === "Esperando apuestas de los jugadores...";
          mensajeSuperior.textContent = `📢 Estado: ${datos.mensaje}`;
        }
      } catch (e) {
        console.error("Error en ruleta/estado:", e);
        mensajeSuperior.textContent = "⏳ Estado: " + payload;
      }

    } else if (topic === "ruleta/confirmacion") {
      if (payload.startsWith(usuario)) {
        confirmaciones.textContent = "✅ " + payload;
      }

    } else if (topic === "ruleta/numeroGanador") {
      try {
        const { numeroGanador } = JSON.parse(payload);
        numeroGanadorPendiente = numeroGanador;

        const ruleta = document.getElementById("ruleta");
        const vueltasRuleta = Math.floor(5 + Math.random() * 5);
        const anguloFinalRuleta = vueltasRuleta * 360;

        // 🧠 PRIMERO actualiza el ángulo acumulado
        anguloAcumulado += anguloFinalRuleta;

        console.log("🎯 Número ganador:", numeroGanador);
        console.log("↻ Vueltas ruleta:", vueltasRuleta);
        console.log("🎯 Ángulo acumulado:", anguloAcumulado.toFixed(2));

        // ✅ Luego actualiza los sectores con el nuevo ángulo
        actualizarSectores();

        // 🌀 Aplica la animación con el nuevo ángulo
        ruleta.style.transition = "transform 4s ease-out";
        ruleta.style.transform = `translate(-50%, -50%) rotate(${anguloAcumulado}deg)`;

        ruletaGirando = true;

        mensajeSuperior.textContent = `🎯 Número ganador: ${numeroGanador}`;
        setTimeout(() => {
          mensajeSuperior.textContent = "";
        }, 5000);

      } catch (e) {
        console.error("❌ Error al animar ruleta con número ganador:", e);
      }
    } else if (topic === `ruleta/resultado/${usuario}`) {
      try {
        const datos = JSON.parse(payload);
        const ganador = datos.numeroGanador;
        const resultadoTexto = datos.resultado?.toUpperCase() || "RESULTADO DESCONOCIDO";

        if (!isNaN(ganador)) {
          resultado.textContent = `🎯 Número ganador: ${ganador} → ${resultadoTexto}`;
          if (datos.resultado === "ganaste") {
            const ganancia = fichaSeleccionada * 36;
            saldo += ganancia;
            actualizarSaldoUI();
          }
        } else {
          resultado.textContent = `⚠️ Resultado inválido`;
        }
      } catch (e) {
        resultado.textContent = `❌ Error al recibir resultado`;
        console.error("Error al procesar resultado:", e);
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
        `ruleta/resultado/${usuario}`,
        "ruleta/numeroGanador" // 🆕
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

  document.getElementById("ruleta").addEventListener("transitionend", (e) => {
    if (e.propertyName !== "transform") return;
    if (!ruletaGirando || numeroGanadorPendiente === null) return;

    ruletaGirando = false;
    actualizarSectores();

    const orbita = document.getElementById("orbita-bola");
    const sector = sectoresBase.find(s => s.numero === numeroGanadorPendiente);
    if (!sector) return;

    const centroSector = (sector.desde + sector.hasta) / 2;
    const anguloRuletaFinal = anguloAcumulado % 360;

    const vueltasBola = Math.floor(5 + Math.random() * 5);
    const extra = vueltasBola * 360;

    const anguloBolaRelativo = (360 - centroSector + anguloRuletaFinal) % 360;
    anguloOrbita -= extra + anguloBolaRelativo;

    orbita.style.transition = "transform 4s ease-out";
    orbita.style.transform = `rotate(${anguloOrbita}deg)`;

    console.log("🎯 Bola gira hacia el número", numeroGanadorPendiente, "con", vueltasBola, "vueltas extra → Ángulo:", anguloOrbita.toFixed(2));

    numeroGanadorPendiente = null;
  });

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

  // Apuestas en casillas
  document.querySelectorAll(".celda").forEach(celda => {
    celda.addEventListener("click", () => {
      const texto = celda.textContent.trim();
      
      if (!puedeApostar) {
        alert("⛔ No se puede apostar en este momento.");
        return;
      }

      if (!fichaSeleccionada || !texto) {
        alert("Selecciona una ficha y una casilla válida.");
        return;
      }

      if (fichaSeleccionada > saldo) {
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }

      const apuesta = {
        usuario,
        numero: texto,
        monto: fichaSeleccionada
      };

      const msgApuesta = new Paho.MQTT.Message(JSON.stringify(apuesta));
      msgApuesta.destinationName = "ruleta/apuestas";
      client.send(msgApuesta);

      saldo -= fichaSeleccionada;
      apuestaTotal += fichaSeleccionada;
      actualizarSaldoUI();
      actualizarApuestaUI();

      // Buscar ficha existente en esta celda
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

      historialApuestas.push({ celda, monto: fichaSeleccionada });
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

  document.querySelector(".boton-control.repetir").addEventListener("click", () => {
    
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
