const numeroInput = document.getElementById("numero");
const mensajeInput = document.querySelector(".chat-input input");
const confirmaciones = document.getElementById("confirmaciones");
const estado = document.getElementById("estado");
const resultado = document.getElementById("resultado");
const mensajesDiv = document.getElementById("mensajes");
const apuestaTotalSpan = document.getElementById("apuesta");
const saldoSpan = document.getElementById("saldo");

const usuario = localStorage.getItem("usuarioRuleta");
document.getElementById("usuario").textContent = usuario;

let client;
let temporizadorID;
let fichaSeleccionada = 0;

let anguloAcumulado = 0;
let anguloOrbita = 0;

const claveSaldo = `saldoRuleta_${usuario}`;
let saldo = parseInt(localStorage.getItem(claveSaldo));
if (isNaN(saldo)) saldo = 5000;

let apuestaTotal = 0;
let historialApuestas = [];

function actualizarSaldoUI() {
  saldoSpan.textContent = `$${saldo.toLocaleString()}`;
  localStorage.setItem(claveSaldo, saldo);
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
          const vueltas = 6; // cantidad de vueltas completas
          const anguloFinal = Math.floor(Math.random() * 360);
          const angulo = (vueltas * 360) + anguloFinal;

          ruleta.style.transition = "transform 4.5s cubic-bezier(0.33, 1, 0.68, 1)"; // tipo easeOutCirc
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
          if (datos.resultado === "ganaste") {
            const ganancia = fichaSeleccionada * 36; // solo si acierta número exacto
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

      client.publish("ruleta/apuestas", JSON.stringify(apuesta));

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
    const ruleta = document.getElementById("ruleta");
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
    orbita.style.transform = `rotate(${anguloOrbita}deg)`;
  });

  // Enviar mensaje
  document.querySelector(".chat-input button").addEventListener("click", enviarMensaje);
  mensajeInput.addEventListener("keydown", e => {
    if (e.key === "Enter") enviarMensaje();
  });
});
