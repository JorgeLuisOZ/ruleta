const calendar = document.getElementById("calendar");
const monthTitle = document.getElementById("monthTitle");

const hoy = new Date();
let year = 2025;
let month = hoy.getMonth();

const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const nombresMes = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

async function obtenerDiasConApuestas(y, m) {
  try {
    const res = await fetch(`/api/apuestas/fechas?year=${y}&month=${m + 1}`);
    const dias = await res.json();
    return new Set(dias); // Para búsqueda rápida
  } catch (err) {
    console.error("❌ Error al obtener días con apuestas:", err);
    return new Set();
  }
}

async function generarCalendario(y, m, direccion = "right") {
  // Limpiar animaciones anteriores
  calendar.classList.remove("calendar-transition-left", "calendar-transition-right");
  void calendar.offsetWidth;
  calendar.classList.add(
    direccion === "left" ? "calendar-transition-left" : "calendar-transition-right"
  );

  calendar.innerHTML = "";
  monthTitle.textContent = `${nombresMes[m].toUpperCase()} ${y}`;

  diasSemana.forEach(dia => {
    const div = document.createElement("div");
    div.textContent = dia;
    div.className = "day-name";
    calendar.appendChild(div);
  });

  const primerDia = new Date(y, m, 1).getDay();
  const totalDias = new Date(y, m + 1, 0).getDate();

  for (let i = 0; i < primerDia; i++) {
    calendar.appendChild(document.createElement("div"));
  }

  // Obtener días con apuestas
  const diasConApuesta = await obtenerDiasConApuestas(y, m);

  for (let d = 1; d <= totalDias; d++) {
    const div = document.createElement("div");
    div.className = "day";

    const spanDia = document.createElement("span");
    spanDia.textContent = d;
    div.appendChild(spanDia);

    // Si ese día tiene apuestas, añade imagen
    if (diasConApuesta.has(d)) {
      const icono = document.createElement("img");
      icono.src = "/img/ficha-historial.png";
      icono.alt = "Apuesta";
      icono.style.width = "50px";
      icono.style.position = "absolute";
      icono.style.top = "6px";
      icono.style.right = "6px";
      div.style.position = "relative";
      div.appendChild(icono);
    }

    div.onclick = () => mostrarHistorial(y, m + 1, d);
    calendar.appendChild(div);
  }
}

function cambiarMes(direccion) {
  const nueva = month + direccion;
  if (nueva < 0 || nueva > 11) return;
  const animDir = direccion === -1 ? "left" : "right";
  month = nueva;
  generarCalendario(year, month, animDir);
}

function mostrarHistorial(y, m, d) {
  const fechaISO = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const fechaBonita = `${d} de ${nombresMes[m - 1]} de ${y}`;

  document.getElementById("modal").style.display = "flex";
  document.getElementById("modalFecha").textContent = `Apuestas del ${fechaBonita}`;
  document.getElementById("modalContenido").innerHTML = "Cargando...";

  fetch(`/api/apuestas?fecha=${fechaISO}`)
    .then(res => res.json())
    .then(data => {
      if (data.length === 0) {
        document.getElementById("modalContenido").innerHTML = "<p>No hay apuestas registradas.</p>";
        return;
      }

      const tabla = `
        <table>
          <tr><th>Jugador</th><th>Número</th><th>Monto</th><th>Fecha</th></tr>
          ${data.map(a => `
            <tr>
                <td>${a.usuario}</td>
                <td>${a.numero}</td>
                <td>${a.monto}</td>
                <td>${new Date(a.fecha).toLocaleString('es-MX', {
                timeZone: 'America/Mexico_City',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
                })}</td>
            </tr>
          `).join("")}
        </table>
      `;
      document.getElementById("modalContenido").innerHTML = tabla;
    })
    .catch(err => {
      document.getElementById("modalContenido").innerHTML = "<p>Error al consultar.</p>";
    });
}

function cerrarModal() {
  document.getElementById("modal").style.display = "none";
}

generarCalendario(year, month);
