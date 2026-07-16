/* ═══════════════════════════════════════════════════════════════
   starfield.js — Estado global, proyección Az/El → canvas,
   visor del sextante, brújula perimetral y 150 estrellas.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const DEG = Math.PI / 180;

// Estado global compartido por todos los módulos
const App = {
  canvas: null,
  ctx: null,
  cx: 0,
  cy: 0,
  visorRadius: 0,

  state: {
    rotacionBrujula: 0,   // azimut de la vista (grados, 0 = Norte)
    pitchOffset: 0,       // desplazamiento de elevación de la vista (grados)
    modeAR: false,        // true = sensores, false = arrastre manual
    observer: { lat: 0, lon: 0, altKm: 0, fixed: false },
    sweepAngle: 0,        // barrido de radar
    selectedStar: null,   // astro fijado por el navegante
    autoPan: false,       // giro automático hacia el astro (solo modo manual)
  },

  stars: [],
  // Ganchos que llenan los otros módulos
  hooks: { drawSatellites: null, drawGame: null, update: null, updateView: null },
};

/* ═══════════ CATÁLOGO DE ESTRELLAS REALES ═══════════
   [nombre, constelación, RA (horas), Dec (grados), magnitud, distancia (al), clase espectral] */
const SPECTRAL_COLOR = {
  O: '#9fc2ff', B: '#a9c8ff', A: '#e8f2f8', F: '#f7f2dc',
  G: '#f5e28e', K: '#f2b264', M: '#ff8f66',
};

const STAR_CATALOG = [
  ['Sirio', 'Can Mayor', 6.752, -16.716, -1.46, 8.6, 'A'],
  ['Canopus', 'Carina', 6.399, -52.696, -0.74, 310, 'F'],
  ['Rigil Kentaurus', 'Centauro', 14.660, -60.834, -0.27, 4.4, 'G'],
  ['Arcturus', 'Boyero', 14.261, 19.182, -0.05, 37, 'K'],
  ['Vega', 'Lira', 18.616, 38.784, 0.03, 25, 'A'],
  ['Capella', 'Auriga', 5.278, 45.998, 0.08, 43, 'G'],
  ['Rigel', 'Orión', 5.242, -8.202, 0.13, 860, 'B'],
  ['Proción', 'Can Menor', 7.655, 5.225, 0.34, 11.5, 'F'],
  ['Achernar', 'Erídano', 1.629, -57.237, 0.46, 139, 'B'],
  ['Betelgeuse', 'Orión', 5.919, 7.407, 0.50, 548, 'M'],
  ['Hadar', 'Centauro', 14.064, -60.373, 0.61, 390, 'B'],
  ['Altair', 'Águila', 19.846, 8.868, 0.77, 16.7, 'A'],
  ['Acrux', 'Cruz del Sur', 12.443, -63.099, 0.76, 320, 'B'],
  ['Aldebarán', 'Tauro', 4.599, 16.509, 0.86, 65, 'K'],
  ['Antares', 'Escorpión', 16.490, -26.432, 0.96, 550, 'M'],
  ['Spica', 'Virgo', 13.420, -11.161, 0.97, 250, 'B'],
  ['Pólux', 'Géminis', 7.755, 28.026, 1.14, 34, 'K'],
  ['Fomalhaut', 'Pez Austral', 22.961, -29.622, 1.16, 25, 'A'],
  ['Deneb', 'Cisne', 20.690, 45.280, 1.25, 2600, 'A'],
  ['Mimosa', 'Cruz del Sur', 12.795, -59.689, 1.25, 280, 'B'],
  ['Régulo', 'Leo', 10.139, 11.967, 1.35, 79, 'B'],
  ['Adhara', 'Can Mayor', 6.977, -28.972, 1.50, 430, 'B'],
  ['Cástor', 'Géminis', 7.577, 31.888, 1.58, 51, 'A'],
  ['Shaula', 'Escorpión', 17.560, -37.104, 1.62, 570, 'B'],
  ['Gacrux', 'Cruz del Sur', 12.519, -57.113, 1.63, 88, 'M'],
  ['Bellatrix', 'Orión', 5.418, 6.350, 1.64, 250, 'B'],
  ['Elnath', 'Tauro', 5.438, 28.608, 1.65, 134, 'B'],
  ['Miaplacidus', 'Carina', 9.220, -69.717, 1.69, 111, 'A'],
  ['Alnilam', 'Orión', 5.604, -1.202, 1.69, 2000, 'B'],
  ['Alnair', 'Grulla', 22.137, -46.961, 1.74, 101, 'B'],
  ['Alnitak', 'Orión', 5.679, -1.943, 1.77, 1260, 'O'],
  ['Alioth', 'Osa Mayor', 12.900, 55.960, 1.77, 83, 'A'],
  ['Dubhe', 'Osa Mayor', 11.062, 61.751, 1.79, 123, 'K'],
  ['Mirfak', 'Perseo', 3.405, 49.861, 1.80, 510, 'F'],
  ['Wezen', 'Can Mayor', 7.140, -26.393, 1.84, 1600, 'F'],
  ['Kaus Australis', 'Sagitario', 18.403, -34.385, 1.85, 143, 'B'],
  ['Avior', 'Carina', 8.375, -59.510, 1.86, 630, 'K'],
  ['Alkaid', 'Osa Mayor', 13.792, 49.313, 1.86, 104, 'B'],
  ['Sargas', 'Escorpión', 17.622, -42.998, 1.87, 300, 'F'],
  ['Menkalinan', 'Auriga', 5.992, 44.948, 1.90, 81, 'A'],
  ['Atria', 'Triángulo Austral', 16.811, -69.028, 1.91, 391, 'K'],
  ['Alhena', 'Géminis', 6.629, 16.399, 1.92, 109, 'A'],
  ['Peacock', 'Pavo', 20.427, -56.735, 1.94, 179, 'B'],
  ['Mirzam', 'Can Mayor', 6.378, -17.956, 1.98, 500, 'B'],
  ['Polaris', 'Osa Menor', 2.530, 89.264, 1.98, 433, 'F'],
  ['Alphard', 'Hidra', 9.460, -8.659, 2.00, 177, 'K'],
  ['Hamal', 'Aries', 2.120, 23.463, 2.00, 66, 'K'],
  ['Diphda', 'Cetus', 0.726, -17.987, 2.02, 96, 'K'],
  ['Mizar', 'Osa Mayor', 13.399, 54.925, 2.04, 83, 'A'],
  ['Nunki', 'Sagitario', 18.921, -26.297, 2.05, 228, 'B'],
  ['Mirach', 'Andrómeda', 1.162, 35.621, 2.05, 197, 'M'],
  ['Alpheratz', 'Andrómeda', 0.140, 29.091, 2.06, 97, 'B'],
  ['Menkent', 'Centauro', 14.111, -36.370, 2.06, 59, 'K'],
  ['Rasalhague', 'Ofiuco', 17.582, 12.560, 2.07, 49, 'A'],
  ['Kochab', 'Osa Menor', 14.845, 74.156, 2.08, 131, 'K'],
  ['Algieba', 'Leo', 10.333, 19.842, 2.08, 130, 'K'],
  ['Saiph', 'Orión', 5.796, -9.670, 2.09, 650, 'B'],
  ['Denebola', 'Leo', 11.818, 14.572, 2.11, 36, 'A'],
  ['Algol', 'Perseo', 3.136, 40.956, 2.12, 90, 'B'],
  ['Etamin', 'Dragón', 17.943, 51.489, 2.23, 154, 'K'],
  ['Schedar', 'Casiopea', 0.675, 56.537, 2.24, 228, 'K'],
  ['Caph', 'Casiopea', 0.153, 59.150, 2.27, 55, 'F'],
  ['Markab', 'Pegaso', 23.079, 15.205, 2.49, 133, 'A'],
];

const STAR_LORE = {
  'Sirio': 'El fanal más brillante del cielo; los perros del mar le aúllan.',
  'Canopus': 'Timonel de la flota celeste; guio a los navíos del sur.',
  'Rigil Kentaurus': 'La taberna estelar más cercana: a cuatro años luz de remo.',
  'Arcturus': 'El guardián del oso; dobla su rumbo y hallarás puerto.',
  'Vega': 'El diamante del arpa; su luz pagaría mil rescates.',
  'Capella': 'La cabrita dorada que da leche de luz a los vigías del norte.',
  'Rigel': 'El pie del cazador; un zafiro que arde a 860 años luz.',
  'Proción': 'Madruga antes que el perro grande; siempre primera al abordaje.',
  'Achernar': 'El fin del río celeste, donde los mapas dicen "aquí hay dragones".',
  'Betelgeuse': 'Brasa moribunda del cazador; cuando estalle, se verá de día.',
  'Altair': 'El águila veloz; gira sobre sí misma como grumete mareado.',
  'Acrux': 'Clavo mayor de la Cruz del Sur, brújula de los mares australes.',
  'Aldebarán': 'El ojo del toro, rojo como el ron puesto al fuego.',
  'Antares': 'Rival de Marte, corazón ardiente del escorpión.',
  'Spica': 'La espiga de la doncella; promete botín en la cosecha.',
  'Pólux': 'El gemelo inmortal; apuesta siempre doble o nada.',
  'Fomalhaut': 'La boca del pez austral; se traga a los marineros distraídos.',
  'Deneb': 'Su luz zarpó hace 2600 años y todavía navega hacia tu ojo.',
  'Régulo': 'El corazón del león; un rey pequeño que exige tributo.',
  'Cástor': 'El gemelo mortal: seis estrellas disfrazadas de una.',
  'Polaris': 'La estrella del Norte: ningún timonel se pierde mientras ella arda.',
  'Algol': 'La estrella del demonio; guiña el ojo cada tres noches.',
  'Mizar': 'El caballo y su jinete; prueba de vista de los viejos vigías.',
};

const GENERIC_LORE = [
  'Un clavo de plata en la tapa del cofre celeste.',
  'Los viejos pilotos la usaban para jurar rumbos imposibles.',
  'Quien la fija tres noches seguidas sueña con tierra firme.',
  'Marca discreta en la carta del contramaestre.',
  'Arde sin prisa, como vela de camarote.',
  'Testigo silenciosa de mil motines.',
  'Su destello vale más que un doblón en noche cerrada.',
  'Faro menor de la ruta de los alisios.',
];

/* ── Proyección: (Azimut, Elevación) → (x, y) en el visor ──
   r = R * (1 - El/90)   |   α = Az - θ - 90°                */
function projectAzEl(az, el) {
  const adjEl = el + App.state.pitchOffset;
  const r = App.visorRadius * (1 - adjEl / 90);
  const alpha = (az - App.state.rotacionBrujula - 90) * DEG;
  return {
    x: App.cx + r * Math.cos(alpha),
    y: App.cy + r * Math.sin(alpha),
    r,
  };
}

/* ── Inicialización del canvas y las estrellas ── */
function initStarfield() {
  App.canvas = document.getElementById('sky-canvas');
  App.ctx = App.canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Estrellas reales del catálogo (Az/El se calculan cada frame)
  App.stars = STAR_CATALOG.map(([name, constellation, raH, decDeg, mag, distLy, spectral], i) => ({
    name, constellation, mag, distLy,
    ra: raH * 15 * DEG,                     // horas → radianes
    dec: decDeg * DEG,
    color: SPECTRAL_COLOR[spectral] || '#e6f4ec',
    // magnitud -1.5 → ~4.2px ; magnitud 2.5 → ~1.4px
    size: Math.max(1.3, 3.2 - mag * 0.75),
    spike: mag < 0.5,                       // cruz de difracción en las más brillantes
    phase: Math.random() * Math.PI * 2,     // fase de parpadeo
    speed: 0.5 + Math.random() * 1.5,
    lore: STAR_LORE[name] || GENERIC_LORE[i % GENERIC_LORE.length],
    az: 0, el: -90,
  }));

  updateStarPositions();
  requestAnimationFrame(renderLoop);
}

/* ── RA/Dec → Az/El del observador (hora sideral local) ── */
function updateStarPositions() {
  const { lat, lon } = App.state.observer;
  const latR = lat * DEG;
  // GMST vía satellite.js (radianes); LST = GMST + longitud
  const lst = satellite.gstime(new Date()) + lon * DEG;

  for (const s of App.stars) {
    const H = lst - s.ra;                   // ángulo horario
    const sinAlt = Math.sin(s.dec) * Math.sin(latR) +
                   Math.cos(s.dec) * Math.cos(latR) * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const az = Math.atan2(
      Math.sin(H),
      Math.cos(H) * Math.sin(latR) - Math.tan(s.dec) * Math.cos(latR)
    ) + Math.PI;                            // atan2 desde el Sur → sumar 180° para medir desde el Norte

    s.el = alt / DEG;
    s.az = ((az / DEG) % 360 + 360) % 360;
  }
}

function resizeCanvas() {
  App.canvas.width = window.innerWidth;
  App.canvas.height = window.innerHeight;
  App.cx = App.canvas.width / 2;
  App.cy = App.canvas.height / 2;
  App.visorRadius = Math.min(App.cx, App.cy) - 30;
}

/* ── Bucle principal ── */
let lastTime = 0;
function renderLoop(t) {
  const dt = Math.min((t - lastTime) / 1000, 0.1);
  lastTime = t;

  const ctx = App.ctx;
  ctx.clearRect(0, 0, App.canvas.width, App.canvas.height);

  updateStarPositions();
  if (App.hooks.update) App.hooks.update(dt);
  if (App.hooks.updateView) App.hooks.updateView(dt);   // inercia del arrastre
  updateAutoPan(dt);

  // Todo lo celeste queda recortado al círculo del visor
  ctx.save();
  ctx.beginPath();
  ctx.arc(App.cx, App.cy, App.visorRadius, 0, Math.PI * 2);
  ctx.clip();

  drawWindRose(ctx);
  drawRadarSweep(ctx, dt);
  drawStars(ctx, t / 1000);
  drawStarSelection(ctx, t / 1000);
  drawHorizonRing(ctx);
  if (App.hooks.drawSatellites) App.hooks.drawSatellites(ctx, t / 1000);

  ctx.restore();

  drawCompassRing(ctx);
  drawGuideArrow(ctx);
  if (App.hooks.drawGame) App.hooks.drawGame(ctx, dt);

  updateBearingReadout();
  requestAnimationFrame(renderLoop);
}

/* ── Rosa de los vientos de 8 puntas, tenue, gira con la brújula ── */
function drawWindRose(ctx) {
  const R = App.visorRadius * 0.52;
  const cx = App.cx, cy = App.cy;
  const base = -App.state.rotacionBrujula * DEG;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(base);

  for (let i = 0; i < 8; i++) {
    const major = i % 2 === 0;
    const a = i * 45 * DEG - Math.PI / 2;
    const len = major ? R : R * 0.6;
    const half = major ? R * 0.08 : R * 0.055;
    const px = Math.cos(a), py = Math.sin(a);
    const ox = -py, oy = px; // perpendicular

    // mitad clara
    ctx.fillStyle = major ? 'rgba(212, 166, 56, 0.14)' : 'rgba(212, 166, 56, 0.09)';
    ctx.beginPath();
    ctx.moveTo(px * len, py * len);
    ctx.lineTo(ox * half, oy * half);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // mitad sombreada
    ctx.fillStyle = major ? 'rgba(138, 109, 47, 0.1)' : 'rgba(138, 109, 47, 0.06)';
    ctx.beginPath();
    ctx.moveTo(px * len, py * len);
    ctx.lineTo(-ox * half, -oy * half);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
  }

  // círculos concéntricos del medallón central
  ctx.strokeStyle = 'rgba(212, 166, 56, 0.16)';
  ctx.lineWidth = 1;
  for (const rr of [R * 0.18, R * 0.09]) {
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/* ── Barrido de radar rotatorio ── */
function drawRadarSweep(ctx, dt) {
  App.state.sweepAngle = (App.state.sweepAngle + dt * 40) % 360;
  const a = App.state.sweepAngle * DEG;
  const grad = ctx.createConicGradient
    ? ctx.createConicGradient(a, App.cx, App.cy)
    : null;
  if (grad) {
    grad.addColorStop(0, 'rgba(57, 255, 20, 0.16)');
    grad.addColorStop(0.08, 'rgba(57, 255, 20, 0.045)');
    grad.addColorStop(0.2, 'rgba(57, 255, 20, 0)');
    grad.addColorStop(1, 'rgba(57, 255, 20, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(App.cx, App.cy, App.visorRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ── Estrellas con parpadeo sinusoidal ── */
function drawStars(ctx, time) {
  for (const s of App.stars) {
    if (s.el < -12) continue;               // bajo el horizonte, fuera de vista
    const p = projectAzEl(s.az, s.el);
    if (p.r > App.visorRadius * 1.05 || p.r < 0) continue;

    // parpadean, pero nunca desaparecen (piso de 0.65)
    const twinkle = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(time * s.speed * 2 + s.phase));

    ctx.globalAlpha = twinkle;
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = s.size * 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // halo suave en las más brillantes
    if (s.size > 2.2) {
      ctx.globalAlpha = twinkle * 0.3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.size * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // cruz de difracción en las mayores
    if (s.spike) {
      const len = s.size * 5 * twinkle;
      ctx.globalAlpha = twinkle * 0.8;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(p.x - len, p.y); ctx.lineTo(p.x + len, p.y);
      ctx.moveTo(p.x, p.y - len); ctx.lineTo(p.x, p.y + len);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/* ── Astro seleccionado: anillo de latón pulsante + nombre ── */
function drawStarSelection(ctx, time) {
  const s = App.state.selectedStar;
  if (!s || s.el < -12) return;
  const p = projectAzEl(s.az, s.el);
  if (p.r > App.visorRadius * 1.1) return;

  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.strokeStyle = '#d4a638';
  ctx.lineWidth = 1.6;
  ctx.shadowColor = '#d4a638';
  ctx.shadowBlur = 8;
  ctx.globalAlpha = 0.6 + 0.4 * pulse;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12 + pulse * 4, 0, Math.PI * 2);
  ctx.stroke();

  // cuatro muescas de sextante alrededor del anillo
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    const r1 = 16 + pulse * 4, r2 = r1 + 6;
    ctx.beginPath();
    ctx.moveTo(p.x + r1 * Math.cos(a), p.y + r1 * Math.sin(a));
    ctx.lineTo(p.x + r2 * Math.cos(a), p.y + r2 * Math.sin(a));
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  ctx.font = "20px 'Pirata One', cursive";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#d4a638';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 4;
  ctx.fillText(s.name, p.x, p.y - 22);
  ctx.shadowBlur = 0;
}

/* ── Flecha-guía en el borde del visor hacia el astro (modo AR o fuera de vista) ── */
function drawGuideArrow(ctx) {
  const s = App.state.selectedStar;
  if (!s) return;
  const p = projectAzEl(s.az, s.el);
  const dx = p.x - App.cx, dy = p.y - App.cy;
  const dist = Math.hypot(dx, dy);
  if (dist < 40 || dist <= App.visorRadius * 0.92) return;  // ya está a la vista

  const a = Math.atan2(dy, dx);
  const edge = App.visorRadius - 34;
  const ex = App.cx + edge * Math.cos(a);
  const ey = App.cy + edge * Math.sin(a);

  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = '#d4a638';
  ctx.shadowColor = '#d4a638';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.font = "15px 'VT323', monospace";
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4a638';
  const lx = App.cx + (edge - 26) * Math.cos(a);
  const ly = App.cy + (edge - 26) * Math.sin(a);
  ctx.fillText(s.name.toUpperCase(), lx, ly);
}

/* ═══════════ NAVEGACIÓN ENTRE ASTROS ═══════════ */

function visibleStarsByBrightness() {
  return App.stars.filter((s) => s.el > 2).sort((a, b) => a.mag - b.mag);
}

function selectStarByStep(step) {
  const list = visibleStarsByBrightness();
  if (!list.length) return;
  const cur = list.indexOf(App.state.selectedStar);
  const next = cur === -1
    ? (step > 0 ? 0 : list.length - 1)
    : (cur + step + list.length) % list.length;
  selectStar(list[next]);
}

function selectStar(star) {
  App.state.selectedStar = star;
  App.state.autoPan = !App.state.modeAR;   // en AR el usuario gira el cuerpo; lo guía la flecha
  updateStarCard();
}

function deselectStar() {
  App.state.selectedStar = null;
  App.state.autoPan = false;
  updateStarCard();
}

/* Auto-pan: gira la vista (modo manual) hasta centrar el astro */
function updateAutoPan(dt) {
  if (!App.state.autoPan || !App.state.selectedStar || App.state.modeAR) return;
  const s = App.state.selectedStar;

  // camino angular más corto en azimut
  let dAz = ((s.az - App.state.rotacionBrujula + 540) % 360) - 180;
  // elevar la vista hasta que el astro quede a ~40% del radio del centro
  const targetPitch = Math.max(-80, Math.min(80, 55 - s.el));
  const dPitch = targetPitch - App.state.pitchOffset;

  const k = Math.min(1, dt * 4);           // easing exponencial
  App.state.rotacionBrujula = ((App.state.rotacionBrujula + dAz * k) % 360 + 360) % 360;
  App.state.pitchOffset += dPitch * k;

  if (Math.abs(dAz) < 0.4 && Math.abs(dPitch) < 0.4) App.state.autoPan = false;
}

/* ── Tarjeta de información del astro ── */
function updateStarCard() {
  const card = document.getElementById('panel-star');
  if (!card) return;
  const s = App.state.selectedStar;
  if (!s) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  document.getElementById('star-name').textContent = s.name;
  document.getElementById('star-constellation').textContent = 'Constelación: ' + s.constellation;
  document.getElementById('star-lore').textContent = '"' + s.lore + '"';
}

/* Datos vivos de la tarjeta (az/el cambian con el cielo) */
setInterval(() => {
  const s = App.state.selectedStar;
  const el = document.getElementById('star-data');
  if (!s || !el) return;
  el.textContent =
    `MAG ${s.mag.toFixed(2)} · DIST ${s.distLy < 100 ? s.distLy.toFixed(1) : Math.round(s.distLy)} AÑOS LUZ · ` +
    `AZ ${String(Math.round(s.az)).padStart(3, '0')}° · EL ${s.el >= 0 ? '+' : '−'}${Math.abs(Math.round(s.el))}°` +
    (s.el <= 2 ? ' · BAJO EL HORIZONTE' : '');
}, 500);

/* ── Anillo del horizonte (Elevación 0°) ── */
function drawHorizonRing(ctx) {
  const r = App.visorRadius * (1 - App.state.pitchOffset / 90);
  if (r <= 0) return;
  ctx.strokeStyle = 'rgba(212, 166, 56, 0.28)';
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(App.cx, App.cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ── Brújula perimetral de latón con marcas de grados ── */
function drawCompassRing(ctx) {
  const R = App.visorRadius;
  const theta = App.state.rotacionBrujula;

  // aro exterior doble de latón (tapa de brújula náutica)
  ctx.strokeStyle = 'rgba(138, 109, 47, 0.95)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(App.cx, App.cy, R + 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(212, 166, 56, 0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(App.cx, App.cy, R + 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(212, 166, 56, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(App.cx, App.cy, R - 2, 0, Math.PI * 2);
  ctx.stroke();

  // remaches del aro exterior cada 45° (fijos, no giran)
  for (let deg = 22.5; deg < 360; deg += 45) {
    const a = deg * DEG;
    const rx = App.cx + (R + 9) * Math.cos(a);
    const ry = App.cy + (R + 9) * Math.sin(a);
    const g = ctx.createRadialGradient(rx - 1, ry - 1, 0.5, rx, ry, 3.5);
    g.addColorStop(0, '#e8c76a');
    g.addColorStop(1, '#4a3a18');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // marcas cada 5°, mayores cada 15°, cardinales cada 90°
  const cardinals = { 0: 'N', 90: 'E', 180: 'S', 270: 'O' };
  for (let deg = 0; deg < 360; deg += 5) {
    const a = (deg - theta - 90) * DEG;
    const major = deg % 15 === 0;
    const inner = R - (major ? 14 : 7);

    ctx.strokeStyle = major ? 'rgba(212, 166, 56, 0.85)' : 'rgba(212, 166, 56, 0.4)';
    ctx.lineWidth = major ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(App.cx + inner * Math.cos(a), App.cy + inner * Math.sin(a));
    ctx.lineTo(App.cx + (R - 2) * Math.cos(a), App.cy + (R - 2) * Math.sin(a));
    ctx.stroke();

    if (deg in cardinals) {
      const isNorth = deg === 0;

      // rombo náutico apuntando al centro
      const tipR = R - 16;
      const baseR = R - 44;
      const halfW = 6;
      const px = Math.cos(a), py = Math.sin(a);
      const ox = -py, oy = px;
      ctx.fillStyle = isNorth ? 'rgba(255, 91, 77, 0.85)' : 'rgba(212, 166, 56, 0.7)';
      ctx.beginPath();
      ctx.moveTo(App.cx + tipR * px, App.cy + tipR * py);
      ctx.lineTo(App.cx + ((tipR + baseR) / 2) * px + halfW * ox, App.cy + ((tipR + baseR) / 2) * py + halfW * oy);
      ctx.lineTo(App.cx + baseR * px, App.cy + baseR * py);
      ctx.lineTo(App.cx + ((tipR + baseR) / 2) * px - halfW * ox, App.cy + ((tipR + baseR) / 2) * py - halfW * oy);
      ctx.closePath();
      ctx.fill();

      const tr = R - 58;
      ctx.font = `${isNorth ? 28 : 22}px 'Pirata One', cursive`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isNorth ? '#ff5b4d' : '#d4a638';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText(cardinals[deg], App.cx + tr * Math.cos(a), App.cy + tr * Math.sin(a));
      ctx.shadowBlur = 0;
    } else if (deg % 45 === 0) {
      const tr = R - 26;
      ctx.font = "13px 'VT323', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(216, 201, 163, 0.75)';
      ctx.fillText(String(deg).padStart(3, '0'), App.cx + tr * Math.cos(a), App.cy + tr * Math.sin(a));
    }
  }

  // aguja fija del rumbo actual (arriba del visor)
  ctx.fillStyle = '#ff5b4d';
  ctx.beginPath();
  ctx.moveTo(App.cx, App.cy - R + 4);
  ctx.lineTo(App.cx - 7, App.cy - R - 14);
  ctx.lineTo(App.cx + 7, App.cy - R - 14);
  ctx.closePath();
  ctx.fill();
}

/* ── Lectura de rumbo en el panel ── */
function updateBearingReadout() {
  const az = ((App.state.rotacionBrujula % 360) + 360) % 360;
  const el = App.state.pitchOffset;
  const azEl = document.getElementById('bearing-az');
  const elEl = document.getElementById('bearing-el');
  if (azEl) azEl.textContent = String(Math.round(az)).padStart(3, '0') + '°';
  if (elEl) elEl.textContent = (el >= 0 ? '+' : '−') + String(Math.abs(Math.round(el))).padStart(2, '0') + '°';
}

/* ── Reloj UTC de la bitácora ── */
setInterval(() => {
  const el = document.getElementById('clock-utc');
  if (el) el.textContent = new Date().toUTCString().slice(17, 25);
}, 1000);

document.addEventListener('DOMContentLoaded', () => {
  initStarfield();
  document.getElementById('btn-prev-star').addEventListener('click', () => selectStarByStep(-1));
  document.getElementById('btn-next-star').addEventListener('click', () => selectStarByStep(1));
  document.getElementById('btn-star-close').addEventListener('click', deselectStar);
});
