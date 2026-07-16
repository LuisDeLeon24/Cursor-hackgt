/* ═══════════════════════════════════════════════════════════════
   game.js — Mira de fijación, sincronización de señal (5 s),
   terminal de interceptación y paisaje sonoro (Web Audio).
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const LOCK_RADIUS_PX = 15;    // distancia de colisión con la mira
const SYNC_SECONDS = 5;       // duración de la sincronización

const Game = {
  progress: 0,          // 0..1
  target: null,         // satélite en la mira
  terminalOpen: false,
  intercepted: new Set(),
};

const PIRATE_MESSAGES = {
  ISS: [
    '»» BOTÍN DETECTADO EN COORDENADAS 19.4326°N, 99.1332°O ««',
    'LA TRIPULACIÓN DE LA ZARYA ESCONDE 400 TONELADAS DE ORO',
    'ESTELAR. CONTRASEÑA DEL COFRE: "KEPLER-TIENE-LA-LLAVE".',
    'FIRMADO: EL CORSARIO ORBITAL, 51.6° DE INCLINACIÓN Y SIN LEY.',
  ],
  HUBBLE: [
    '»» DIARIO DEL VIGÍA DEL HUBBLE — ENTRADA 20580 ««',
    'HE VISTO GALAXIAS QUE NINGÚN PIRATA SAQUEARÁ JAMÁS.',
    'EL VERDADERO TESORO ESTABA EN EL ESPEJO PRIMARIO.',
    'QUIEN INTERCEPTE ESTO: CUIDAD EL CIELO, ES EL ÚNICO MAPA.',
  ],
};

/* ── Bucle del juego: colisión + progreso ── */
function updateGame(dt) {
  if (Game.terminalOpen) return;

  let candidate = null;
  let bestDist = Infinity;
  for (const sat of SATELLITES) {
    if (!sat.visible) continue;
    const p = projectAzEl(sat.az, sat.el);
    const d = Math.hypot(p.x - App.cx, p.y - App.cy);
    if (d < bestDist) { bestDist = d; candidate = sat; }
  }

  if (candidate && bestDist < LOCK_RADIUS_PX) {
    if (Game.target !== candidate) { Game.target = candidate; Game.progress = 0; }
    Game.progress += dt / SYNC_SECONDS;
    beepSync();
    if (Game.progress >= 1) {
      Game.progress = 0;
      openTerminal(Game.target);
      Game.target = null;
    }
  } else {
    // la señal decae si el satélite escapa de la mira
    Game.progress = Math.max(0, Game.progress - dt / (SYNC_SECONDS * 0.6));
    if (Game.progress === 0) Game.target = null;
  }
}

/* ── Mira + barra de progreso circular ── */
function drawGame(ctx, dt) {
  updateGame(dt);

  const cx = App.cx, cy = App.cy;
  const locking = Game.progress > 0;
  const col = locking ? '#39ff14' : 'rgba(212, 166, 56, 0.9)';

  // cruz de la mira
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const [dx1, dy1, dx2, dy2] of [
    [-26, 0, -9, 0], [9, 0, 26, 0],
    [0, -26, 0, -9], [0, 9, 0, 26],
  ]) {
    ctx.moveTo(cx + dx1, cy + dy1);
    ctx.lineTo(cx + dx2, cy + dy2);
  }
  ctx.stroke();

  // círculo de la zona de fijación
  ctx.beginPath();
  ctx.arc(cx, cy, LOCK_RADIUS_PX, 0, Math.PI * 2);
  ctx.stroke();

  if (locking) {
    // anillo de progreso alrededor de la mira
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, -Math.PI / 2, -Math.PI / 2 + Game.progress * Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = "17px 'VT323', monospace";
    ctx.textAlign = 'center';
    ctx.fillStyle = '#39ff14';
    ctx.fillText(
      `SINCRONIZANDO SEÑAL ${Math.round(Game.progress * 100)}%`,
      cx, cy + 58
    );
  }
}

/* ── Terminal de interceptación ── */
function openTerminal(sat) {
  Game.terminalOpen = true;
  playUnlockChord();

  const overlay = document.getElementById('terminal-overlay');
  const body = document.getElementById('terminal-body');
  overlay.classList.remove('hidden');
  overlay.classList.add('open');
  body.textContent = '';

  const lines = PIRATE_MESSAGES[sat.name] || PIRATE_MESSAGES.ISS;
  const already = Game.intercepted.has(sat.name);
  Game.intercepted.add(sat.name);

  // Fase 1: lluvia de binario/Morse; Fase 2: descifrado línea a línea
  let ticks = 0;
  const noiseTimer = setInterval(() => {
    ticks++;
    body.textContent += randomCipherLine() + '\n';
    body.scrollTop = body.scrollHeight;
    if (ticks >= 14) {
      clearInterval(noiseTimer);
      body.textContent += '\n── DESCIFRANDO CON CLAVE SGP4-25544 ──\n\n';
      typeLines(body, [
        `OBJETIVO: ${sat.label}`,
        `RANGO: ${Math.round(sat.rangeKm)} km · ALTITUD: ${Math.round(sat.altKm)} km`,
        already ? '(TRANSMISIÓN YA SAQUEADA, PERO EL MAR REPITE SUS CANCIONES)' : '',
        '',
        ...lines,
      ].filter((l) => l !== null));
    }
  }, 90);
}

function randomCipherLine() {
  const bin = () => Array.from({ length: 8 }, () => (Math.random() < 0.5 ? '0' : '1')).join('');
  const morse = () => Array.from({ length: 10 }, () => (Math.random() < 0.5 ? '·' : '−')).join(' ');
  return Math.random() < 0.5
    ? `${bin()} ${bin()} ${bin()} ${bin()}`
    : morse();
}

function typeLines(el, lines) {
  let i = 0;
  const t = setInterval(() => {
    if (i >= lines.length) { clearInterval(t); return; }
    el.textContent += lines[i] + '\n';
    el.scrollTop = el.scrollHeight;
    beepType();
    i++;
  }, 320);
}

function closeTerminal() {
  const overlay = document.getElementById('terminal-overlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('open');
  Game.terminalOpen = false;
  Game.progress = 0;
}

/* ═══════════ PAISAJE SONORO — Web Audio, sin archivos ═══════════ */

const Ocean = { ctx: null, gain: null, on: false };

function audioCtx() {
  if (!Ocean.ctx) Ocean.ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (Ocean.ctx.state === 'suspended') Ocean.ctx.resume();
  return Ocean.ctx;
}

/* Olas de mar: ruido marrón + filtro grave + vaivén lento de ganancia */
function startOcean() {
  if (Ocean.on) return;
  const ctx = audioCtx();

  const bufferSize = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;   // ruido marrón
    data[i] = last * 3.5;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;

  Ocean.gain = ctx.createGain();
  Ocean.gain.gain.value = 0.06;

  // vaivén de las olas (LFO sobre la ganancia)
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.11;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain).connect(Ocean.gain.gain);

  src.connect(filter).connect(Ocean.gain).connect(ctx.destination);
  src.start();
  lfo.start();
  Ocean.on = true;
  updateSoundButton();
}

function toggleOcean() {
  if (!Ocean.on) { startOcean(); return; }
  const muted = Ocean.gain.gain.value < 0.001;
  Ocean.gain.gain.value = muted ? 0.06 : 0;
  updateSoundButton(!muted);
}

function updateSoundButton(mutedNow) {
  const btn = document.getElementById('btn-sound');
  const muted = mutedNow ?? (Ocean.gain && Ocean.gain.gain.value < 0.001);
  btn.classList.toggle('btn-off', !!muted);
}

/* Bips de sonar durante la sincronización */
let lastBeep = 0;
function beepSync() {
  const now = performance.now();
  if (now - lastBeep < 250) return;
  lastBeep = now;
  blip(880 + Game.progress * 660, 0.05, 0.04);
}

function beepType() { blip(1320, 0.02, 0.015); }

function playUnlockChord() {
  [523, 659, 784, 1047].forEach((f, i) =>
    setTimeout(() => blip(f, 0.25, 0.06), i * 110)
  );
}

function blip(freq, dur, vol) {
  try {
    const ctx = audioCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch (_) { /* audio bloqueado: el juego sigue */ }
}

/* ── Enganches ── */
document.addEventListener('DOMContentLoaded', () => {
  App.hooks.drawGame = drawGame;
  document.getElementById('btn-terminal-close').addEventListener('click', closeTerminal);
  document.getElementById('btn-sound').addEventListener('click', toggleOcean);
});
