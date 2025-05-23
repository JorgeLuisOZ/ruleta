const numeroInput = document.getElementById("numero");
const mensajeInput = document.querySelector(".chat-input input");
const confirmaciones = document.getElementById("confirmaciones");
const estado = document.getElementById("estado");
const resultado = document.getElementById("resultado");
const mensajesDiv = document.getElementById("mensajes");
const apuestaTotalSpan = document.getElementById("apuesta");
const saldoSpan = document.getElementById("saldo");
const mensajeSuperior = document.getElementById("mensaje-superior");

const usuario = sessionStorage.getItem("usuarioRuleta");
document.getElementById("usuario").textContent = usuario;

let client;
let temporizadorID;
let fichaSeleccionada = 0;
let puedeApostar = false;
let anguloAcumulado = 0;
let anguloOrbita = 0;

const claveSaldo = `saldoRuleta_${usuario}`;
let saldo = parseInt(sessionStorage.getItem(claveSaldo));
if (isNaN(saldo)) saldo = 5000;

let apuestaTotal = 0;
let historialApuestas = [];

const numerosRuleta = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
  6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
  29, 7, 28, 12, 35, 3, 26];

const offset = 355;
const sectoresBase = [];
const totalNumeros = numerosRuleta.length;
const anguloSector = 360 / totalNumeros;

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

          const ruleta = document.getElementById("ruleta");
          const orbita = document.getElementById("orbita-bola");

          anguloAcumulado += Math.floor((5 + Math.random() * 2) * 360);
          anguloOrbita -= Math.floor((5 + Math.random() * 2) * 360);

          ruleta.style.transition = "transform 4s ease-out";
          ruleta.style.transform = `translate(-50%, -50%) rotate(${anguloAcumulado}deg)`;

          orbita.style.transition = "transform 4s ease-out";
          orbita.style.transform = `rotate(${anguloOrbita}deg)`;

          mensajeSuperior.textContent = "🎰 Girando...";

        } else {
          puedeApostar = datos.mensaje === "esperando apuestas de los jugadores...";
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

    } else if (topic.startsWith("ruleta/resultado/")) {
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

    } else if (topic === "ruleta/chat/visible") {
      const p = document.createElement("p");
      p.textContent = payload;
      mensajesDiv.appendChild(p);
      mensajesDiv.scrollTop = mensajesDiv.scrollHeight;
    }
  };

  client.connect({
    onSuccess: () => {
      console.log("✅ Conectado al broker MQTT como", usuario);

      const topics = [
        "ruleta/estado",
        "ruleta/confirmacion",
        "ruleta/chat/visible",
        `ruleta/resultado/${usuario}`
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

      // 🔄 Reforzar recepción del estado reenviando la suscripción
      client.unsubscribe("ruleta/estado");
      client.subscribe("ruleta/estado");
      console.log("🔄 Re-suscripción forzada a ruleta/estado");

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
    /* const ruleta = document.getElementById("ruleta");
    const vueltas = 5 + Math.random() * 2; // entre 5 y 7 vueltas
    const angulo = vueltas * 360;
    anguloAcumulado += angulo;

    ruleta.style.transition = "transform 4s cubic-bezier(0.33, 1, 0.68, 1)";
    ruleta.style.transform = `translate(-50%, -50%) rotate(${anguloAcumulado}deg)`;

    const orbita = document.getElementById("orbita-bola");

    const vueltasBola = 5 + Math.random() * 2;
    const anguloBola = vueltasBola * 360;

    anguloOrbita -= anguloBola; // gira en sentido contrario a la ruleta
    orbita.style.transition = "transform 4s cubic-bezier(0.33, 1, 0.68, 1)";
    orbita.style.transform = `rotate(${anguloOrbita}deg)`;*/
  });
  
  // Función para obtener ángulo de rotación desde el transform CSS
  function obtenerAnguloDeRotacion(elemento) {
    const estilo = window.getComputedStyle(elemento);
    const transform = estilo.transform || estilo.webkitTransform;

    if (transform && transform !== "none") {
      const valores = transform.match(/matrix\(([^)]+)\)/);
      if (!valores) return 0;
      const partes = valores[1].split(",");
      const a = parseFloat(partes[0]);
      const b = parseFloat(partes[1]);
      let angulo = Math.round(Math.atan2(b, a) * (180 / Math.PI));
      if (angulo < 0) angulo += 360;
      return angulo;
    }
    return 0;
  }

  // Función para ajustar sector con rotación actual de la ruleta
  function sectorConRotacion(sector, rotacion) {
    return {
      numero: sector.numero,
      desde: (sector.desde + rotacion) % 360,
      hasta: (sector.hasta + rotacion) % 360
    };
  }

  // Función para encontrar número ganador comparando ángulo bola con sectores rotados
  function encontrarNumeroGanador(anguloBola, sectores, rotacionRuleta) {
    for (const sector of sectores) {
      const sectorRot = sectorConRotacion(sector, rotacionRuleta);
      if (sectorRot.desde > sectorRot.hasta) {
        // Sector cruza 0 grados
        if (anguloBola >= sectorRot.desde || anguloBola <= sectorRot.hasta) {
          return sectorRot.numero;
        }
      } else {
        if (anguloBola >= sectorRot.desde && anguloBola <= sectorRot.hasta) {
          return sectorRot.numero;
        }
      }
    }
    return null;
  }

  function detectarNumeroGanador() {
    const ruleta = document.getElementById("ruleta");
    const orbita = document.getElementById("orbita-bola");

    const anguloRuleta = obtenerAnguloDeRotacion(ruleta);
    const anguloBola = obtenerAnguloDeRotacion(orbita);

    const numeroGanador = encontrarNumeroGanador(anguloBola, sectoresBase, anguloRuleta);

    console.log('Ángulo ruleta:', anguloRuleta);
    console.log('Ángulo bola:', anguloBola);
    console.log('Número ganador:', numeroGanador);

    // ✅ Solo se muestra visualmente el resultado
    mensajeSuperior.textContent = `🎯 Número ganador: ${numeroGanador}`;
    
    const msgNumero = new Paho.MQTT.Message(JSON.stringify({ numeroGanador }));
    msgNumero.destinationName = "ruleta/numeroGanador";
    client.send(msgNumero);

    // Opcional: borrar mensaje después de 5 segundos
    setTimeout(() => {
      mensajeSuperior.textContent = "";
    }, 5000);
  }

  // Escuchar cuando termina la animación de ruleta y bola
  const ruleta = document.getElementById("ruleta");
  const orbita = document.getElementById("orbita-bola");

  ruleta.addEventListener("transitionend", () => {
    detectarNumeroGanador();
  });

  orbita.addEventListener("transitionend", () => {
    detectarNumeroGanador();
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
    msgChat.destinationName = "ruleta/chat";
    client.send(msgChat);

    mensajeInput.value = "";
  }

});
