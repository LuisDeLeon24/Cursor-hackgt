/* ═══════════════════════════════════════════════════════════════
   sensors.js — Cámara trasera, giroscopio (DeviceOrientation),
   geolocalización y fallback manual de arrastre.

   Los navegadores modernos (Safari/iOS en particular) bloquean la
   API de DeviceOrientation hasta que un gesto explícito del usuario
   solicita el permiso. Por eso el firmamento se movía "estático":
   nunca llegaba a activarse el listener. El botón "Calibrar Sextante"
   es ahora el disparador obligatorio de ese permiso.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const Sensors = {
  orientationAvailable: false,   // ha llegado al menos un evento real
  orientationGranted: false,     // el usuario concedió el permiso
  listening: false,              // el listener está enganchado
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

/* ═══════════ GIROSCOPIO / BRÚJULA ═══════════ */

/* ── Manejador del evento deviceorientation ──
   Mapeo de ejes:
     · event.alpha  → rotación de la brújula (eje Z, 0..360) → rotacionBrujula
     · event.beta   → inclinación (eje X)                    → elevacionVista
   Escribimos sobre los OBJETIVOS del estado; el bucle de render
   interpola suavemente hacia ellos (ver aplicarSuavizado en starfield.js),
   de modo que el pulso tembloroso del pirata no produce saltos bruscos.  */
function manejarMovimiento(event) {
  if (!App.state.modeAR) return;
  if (event.alpha === null || event.alpha === undefined) return;

  Sensors.orientationAvailable = true;

  // Rumbo (azimut sobre el eje Z). iOS expone la brújula real ya calibrada
  // al norte magnético; el resto de navegadores dan alpha antihorario.
  const heading = (typeof event.webkitCompassHeading === 'number')
    ? event.webkitCompassHeading
    : 360 - event.alpha;
  App.state.targetRotacion = ((heading % 360) + 360) % 360;

  // Elevación de la vista a partir de la inclinación (beta).
  // beta ≈ 90° con el móvil vertical mirando al horizonte;
  // al inclinarlo hacia atrás para mirar al cielo, beta crece.
  if (typeof event.beta === 'number') {
    const elevacionVista = Math.max(-80, Math.min(80, event.beta - 90));
    App.state.targetElevacion = elevacionVista;
  }

  // El firmamento se redibuja en cada frame del bucle continuo,
  // pero forzamos un dibujado inmediato para máxima reactividad.
  if (typeof dibujarFirmamento === 'function') dibujarFirmamento();
}

/* ── Enganchar el listener una sola vez ── */
function activarListenerOrientacion() {
  if (Sensors.listening) return;
  window.addEventListener('deviceorientation', manejarMovimiento, true);
  // Algunos Android exponen la brújula absoluta por un canal distinto.
  window.addEventListener('deviceorientationabsolute', manejarMovimiento, true);
  Sensors.listening = true;
}

/* ── Solicitud de permisos dinámica (iOS / Android / escritorio) ──
   Debe invocarse SIEMPRE desde un gesto del usuario (clic en el botón). */
async function solicitarPermisosSensores() {
  const soportado = typeof DeviceOrientationEvent !== 'undefined';
  if (!soportado) {
    marcarSensoresDenegados('SIN SENSORES · TIMÓN MANUAL');
    return false;
  }

  // Safari / iOS 13+: hay que pedir permiso explícito.
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      Sensors.orientationGranted = (res === 'granted');
    } catch (_) {
      Sensors.orientationGranted = false;
    }
  } else {
    // Android / escritorio: no requieren permiso previo.
    Sensors.orientationGranted = true;
  }

  if (Sensors.orientationGranted) {
    activarListenerOrientacion();
    setMode(true);
    marcarSensoresActivos();
    // Verificamos que realmente lleguen eventos; si no, volvemos a manual.
    setTimeout(() => {
      if (!Sensors.orientationAvailable) {
        setMode(false);
        marcarSensoresDenegados('SENSOR MUDO · TIMÓN MANUAL');
      }
    }, 1500);
    return true;
  }

  // Denegado: el timón manual sigue disponible como respaldo.
  setMode(false);
  marcarSensoresDenegados('PERMISO DENEGADO · TIMÓN MANUAL');
  return false;
}

/* ── Estados visuales del botón de calibración ── */
function marcarSensoresActivos() {
  const btn = document.getElementById('btn-calibrate');
  const label = document.getElementById('btn-calibrate-label');
  if (!btn) return;
  btn.classList.remove('sensors-denied');
  btn.classList.add('sensors-ok');
  if (label) label.textContent = 'SENSORES ACTIVOS';
  // Se desvanece suavemente pasado un instante.
  setTimeout(() => btn.classList.add('hidden-fade'), 1200);
}

function marcarSensoresDenegados(texto) {
  const btn = document.getElementById('btn-calibrate');
  const label = document.getElementById('btn-calibrate-label');
  if (!btn) return;
  btn.classList.remove('sensors-ok', 'hidden-fade');
  btn.classList.add('sensors-denied');
  if (label) label.textContent = texto || 'TIMÓN MANUAL';
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

/* ── Fallback: arrastre con ratón (PC) o dedo (móvil) como timón ──
   Escribe sobre los objetivos para compartir el mismo suavizado. */
function initDragFallback() {
  const canvas = document.getElementById('sky-canvas');
  let dragging = false;
  let lastX = 0, lastY = 0;
  let velAz = 0, velPitch = 0;   // grados/frame que quedan "vivos" al soltar

  const start = (x, y) => {
    dragging = true;
    lastX = x; lastY = y;
    velAz = 0; velPitch = 0;
    App.state.autoPan = false;   // el navegante toma el timón: cancelar auto-pan
    canvas.classList.add('dragging');
  };
  const move = (x, y) => {
    if (!dragging || App.state.modeAR) return;
    const dAz = -(x - lastX) * 0.35;
    const dPitch = (y - lastY) * 0.22;
    App.state.targetRotacion = ((App.state.targetRotacion + dAz) % 360 + 360) % 360;
    App.state.targetElevacion = Math.max(-80, Math.min(80, App.state.targetElevacion + dPitch));
    velAz = dAz; velPitch = dPitch;
    lastX = x; lastY = y;
  };
  const end = () => { dragging = false; canvas.classList.remove('dragging'); };

  canvas.addEventListener('pointerdown', (e) => start(e.clientX, e.clientY));
  window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);

  // Inercia: el cielo sigue girando al soltar, amortiguándose
  App.hooks.updateView = () => {
    if (App.state.autoPan) { velAz = 0; velPitch = 0; return; }
    if (dragging || App.state.modeAR) return;
    if (Math.abs(velAz) < 0.01 && Math.abs(velPitch) < 0.01) return;
    App.state.targetRotacion = ((App.state.targetRotacion + velAz) % 360 + 360) % 360;
    App.state.targetElevacion = Math.max(-80, Math.min(80, App.state.targetElevacion + velPitch));
    velAz *= 0.92;
    velPitch *= 0.92;
  };
}

/* ── Zarpar: se ejecuta con el gesto del botón de inicio ── */
async function setSail() {
  const overlay = document.getElementById('start-overlay');
  overlay.classList.add('fading');
  setTimeout(() => overlay.remove(), 800);
  document.body.classList.add('sailing');   // revela el botón "Calibrar Sextante"

  initCamera();
  initGeolocation();

  // Arrancamos en MANUAL: el firmamento ya responde al arrastre.
  // El modo AR se activa cuando el navegante pulsa "Calibrar Sextante".
  setMode(false);

  if (typeof startOcean === 'function') startOcean();
}

document.addEventListener('DOMContentLoaded', () => {
  initDragFallback();

  document.getElementById('btn-start').addEventListener('click', setSail);

  // Botón dedicado: único disparador fiable del permiso de sensores.
  document.getElementById('btn-calibrate').addEventListener('click', solicitarPermisosSensores);

  // El botón de la barra alterna AR/manual; al pedir AR reutiliza el flujo de permisos.
  document.getElementById('btn-mode').addEventListener('click', async () => {
    if (!App.state.modeAR) {
      await solicitarPermisosSensores();
    } else {
      setMode(false);
    }
  });
});
