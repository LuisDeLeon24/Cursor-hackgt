/* ═══════════════════════════════════════════════════════════════
   sensors.js — Cámara trasera, giroscopio (DeviceOrientation),
   geolocalización y fallback manual de arrastre.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const Sensors = {
  orientationAvailable: false,
  orientationGranted: false,
  listening: false,
};

/* ── Cámara trasera proyectada al fondo ── */
async function initCamera() {
  const video = document.getElementById('camera-feed');
  const attempts = [
    { video: { facingMode: { exact: 'environment' } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
    { video: true, audio: false },
  ];
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play().catch(() => {});
      return true;
    } catch (_) { /* probar la siguiente restricción */ }
  }
  console.warn('Sin cámara: se navega sobre el abismo oscuro.');
  return false;
}

/* ── Geolocalización del observador ── */
function initGeolocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      App.state.observer.lat = pos.coords.latitude;
      App.state.observer.lon = pos.coords.longitude;
      App.state.observer.altKm = (pos.coords.altitude || 0) / 1000;
      App.state.observer.fixed = true;
      updateObserverReadout();
      if (typeof onObserverFixed === 'function') onObserverFixed();
    },
    () => {
      // Fallback: coordenadas por defecto (0, 0)
      App.state.observer.fixed = true;
      updateObserverReadout();
      if (typeof onObserverFixed === 'function') onObserverFixed();
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
  );
}

function updateObserverReadout() {
  const { lat, lon } = App.state.observer;
  const fmt = (v, pos, neg) =>
    Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? pos : neg);
  document.getElementById('obs-lat').textContent = fmt(lat, 'N', 'S');
  document.getElementById('obs-lon').textContent = fmt(lon, 'E', 'O');
}

/* ── Giroscopio / brújula ── */
function handleOrientation(e) {
  if (!App.state.modeAR) return;
  if (e.alpha === null || e.alpha === undefined) return;

  Sensors.orientationAvailable = true;

  // iOS expone la brújula real; en el resto, alpha crece en sentido antihorario
  const heading = (typeof e.webkitCompassHeading === 'number')
    ? e.webkitCompassHeading
    : 360 - e.alpha;

  App.state.rotacionBrujula = ((heading % 360) + 360) % 360;

  // beta ≈ 90° con el móvil vertical apuntando al horizonte
  if (typeof e.beta === 'number') {
    const pitch = Math.max(-80, Math.min(80, e.beta - 90));
    App.state.pitchOffset = pitch;
  }
}

async function requestOrientationPermission() {
  // iOS 13+ exige permiso explícito tras un gesto del usuario
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      Sensors.orientationGranted = res === 'granted';
    } catch (_) {
      Sensors.orientationGranted = false;
    }
  } else {
    Sensors.orientationGranted = true; // Android / escritorio: sin permiso previo
  }

  if (Sensors.orientationGranted && !Sensors.listening) {
    window.addEventListener('deviceorientation', handleOrientation, true);
    Sensors.listening = true;
  }
  return Sensors.orientationGranted;
}

/* ── Alternar Modo AR / Manual ── */
function setMode(ar) {
  App.state.modeAR = ar;
  const btn = document.getElementById('btn-mode');
  const label = document.getElementById('mode-label');
  if (ar) {
    btn.textContent = '☸ MODO AR';
    btn.classList.remove('btn-off');
    label.textContent = 'AR·GIRO';
  } else {
    btn.textContent = '✋ MANUAL';
    btn.classList.add('btn-off');
    label.textContent = 'MANUAL';
  }
}

/* ── Fallback: arrastre con ratón o dedo ── */
function initDragFallback() {
  const canvas = document.getElementById('sky-canvas');
  let dragging = false;
  let lastX = 0, lastY = 0;

  const start = (x, y) => { dragging = true; lastX = x; lastY = y; canvas.classList.add('dragging'); };
  const move = (x, y) => {
    if (!dragging || App.state.modeAR) return;
    App.state.rotacionBrujula = ((App.state.rotacionBrujula - (x - lastX) * 0.35) % 360 + 360) % 360;
    App.state.pitchOffset = Math.max(-80, Math.min(80, App.state.pitchOffset + (y - lastY) * 0.22));
    lastX = x; lastY = y;
  };
  const end = () => { dragging = false; canvas.classList.remove('dragging'); };

  canvas.addEventListener('pointerdown', (e) => start(e.clientX, e.clientY));
  window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

/* ── Zarpar: se ejecuta con el gesto del botón de inicio ── */
async function setSail() {
  const overlay = document.getElementById('start-overlay');
  overlay.classList.add('fading');
  setTimeout(() => overlay.remove(), 800);
  document.body.classList.add('sailing');

  initCamera();
  initGeolocation();

  const granted = await requestOrientationPermission();
  // Arrancamos en AR si hay sensores; el fallback manual siempre queda disponible
  setMode(granted && ('DeviceOrientationEvent' in window));

  // Si tras 2s no llegó ningún evento de orientación, caemos a manual
  setTimeout(() => {
    if (App.state.modeAR && !Sensors.orientationAvailable) setMode(false);
  }, 2000);

  if (typeof startOcean === 'function') startOcean();
}

document.addEventListener('DOMContentLoaded', () => {
  initDragFallback();
  document.getElementById('btn-start').addEventListener('click', setSail);
  document.getElementById('btn-mode').addEventListener('click', async () => {
    if (!App.state.modeAR) {
      const ok = await requestOrientationPermission();
      setMode(ok);
      if (!ok) setMode(false);
    } else {
      setMode(false);
    }
  });
});
