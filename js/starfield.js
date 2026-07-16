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
  },

  stars: [],
  // Ganchos que llenan los otros módulos
  hooks: { drawSatellites: null, drawGame: null, update: null },
};

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

  // 150 estrellas repartidas por la bóveda celeste
  for (let i = 0; i < 150; i++) {
    App.stars.push({
      az: Math.random() * 360,
      el: Math.random() * 100 - 10,          // algunas bajo el horizonte
      size: 0.6 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,    // fase de parpadeo
      speed: 0.5 + Math.random() * 1.5,
      warm: Math.random() < 0.18,            // algunas estrellas doradas
    });
  }

  requestAnimationFrame(renderLoop);
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

  if (App.hooks.update) App.hooks.update(dt);

  // Todo lo celeste queda recortado al círculo del visor
  ctx.save();
  ctx.beginPath();
  ctx.arc(App.cx, App.cy, App.visorRadius, 0, Math.PI * 2);
  ctx.clip();

  drawRadarSweep(ctx, dt);
  drawStars(ctx, t / 1000);
  drawHorizonRing(ctx);
  if (App.hooks.drawSatellites) App.hooks.drawSatellites(ctx, t / 1000);

  ctx.restore();

  drawCompassRing(ctx);
  if (App.hooks.drawGame) App.hooks.drawGame(ctx, dt);

  updateBearingReadout();
  requestAnimationFrame(renderLoop);
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
    const p = projectAzEl(s.az, s.el);
    if (p.r > App.visorRadius * 1.05 || p.r < 0) continue;

    const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * s.speed * 2 + s.phase));
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = s.warm ? '#e8cf8a' : '#cfe8dd';
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.size, 0, Math.PI * 2);
    ctx.fill();

    // halo suave en las más brillantes
    if (s.size > 1.8) {
      ctx.globalAlpha = twinkle * 0.25;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

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

  // aro exterior de latón
  ctx.strokeStyle = 'rgba(138, 109, 47, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(App.cx, App.cy, R + 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(212, 166, 56, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(App.cx, App.cy, R - 2, 0, Math.PI * 2);
  ctx.stroke();

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
      const tr = R - 30;
      const isNorth = deg === 0;
      ctx.font = `${isNorth ? 26 : 20}px 'Pirata One', cursive`;
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
  ctx.lineTo(App.cx - 7, App.cy - R - 12);
  ctx.lineTo(App.cx + 7, App.cy - R - 12);
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

document.addEventListener('DOMContentLoaded', initStarfield);
