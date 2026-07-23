/* ═══════════════════════════════════════════════════════════════
   orbits.js — Propagación SGP4 en tiempo real con satellite.js.
   TLE → ECI → ECF → Look Angles (Azimut / Elevación) del observador.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const SATELLITES = [
  {
    name: 'ISS',
    label: 'ISS (ZARYA)',
    tle1: '1 25544U 98067A   26197.51864197  .00014389  00000-0  25368-3 0  9993',
    tle2: '2 25544  51.6421  74.3215 0001241 123.4111 281.3322 15.49817452528143',
    color: '#2a3d8f',
  },
  {
    name: 'HUBBLE',
    label: 'HUBBLE SPACE TELESCOPE',
    tle1: '1 20580U 90037B   26197.12345678  .00001234  00000-0  10000-3 0  9991',
    tle2: '2 20580  28.4682 112.3411 0002341 210.1111 149.8888 14.99213452991234',
    color: '#6b4a1e',
  },
];

const TRAIL_MINUTES = 15;
const TRAIL_STEP_SEC = 20;
let trailTimer = null;

/* ── Inicializar registros SGP4 ── */
function initOrbits() {
  for (const sat of SATELLITES) {
    sat.satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
    sat.az = 0; sat.el = -90; sat.altKm = 0; sat.rangeKm = 0;
    sat.latDeg = 0; sat.lonDeg = 0;   // punto subsatélite (posición sobre la Tierra)
    sat.visible = false;
    sat.trail = [];
  }
  App.hooks.drawSatellites = drawSatellites;
  App.hooks.update = updateSatellites;
  setInterval(updateSatPanel, 500);
}

function observerGd() {
  return {
    longitude: satellite.degreesToRadians(App.state.observer.lon),
    latitude: satellite.degreesToRadians(App.state.observer.lat),
    height: App.state.observer.altKm,
  };
}

/* ── Az/El/Alt/Rango de un satélite en un instante dado ── */
function lookAnglesAt(sat, date) {
  const pv = satellite.propagate(sat.satrec, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
  const gmst = satellite.gstime(date);
  const positionEcf = satellite.eciToEcf(pv.position, gmst);
  const geo = satellite.eciToGeodetic(pv.position, gmst);
  const look = satellite.ecfToLookAngles(observerGd(), positionEcf);
  return {
    az: satellite.radiansToDegrees(look.azimuth),
    el: satellite.radiansToDegrees(look.elevation),
    rangeKm: look.rangeSat,
    altKm: geo.height,
    latDeg: satellite.radiansToDegrees(geo.latitude),
    lonDeg: normalizeLon(satellite.radiansToDegrees(geo.longitude)),
  };
}

/* Normaliza la longitud geodésica al rango [-180, 180] */
function normalizeLon(lon) {
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

/* ── Propagación en cada frame (reloj del sistema) ── */
function updateSatellites() {
  const now = new Date();
  for (const sat of SATELLITES) {
    const la = lookAnglesAt(sat, now);
    if (!la) { sat.visible = false; continue; }
    sat.az = la.az;
    sat.el = la.el;
    sat.altKm = la.altKm;
    sat.rangeKm = la.rangeKm;
    sat.latDeg = la.latDeg;
    sat.lonDeg = la.lonDeg;
    sat.visible = la.el > 0;
  }
}

/* ── Estela: últimos 15 minutos, precalculada cada 30 s ── */
function computeTrails() {
  const now = Date.now();
  for (const sat of SATELLITES) {
    const pts = [];
    for (let s = TRAIL_MINUTES * 60; s >= 0; s -= TRAIL_STEP_SEC) {
      const la = lookAnglesAt(sat, new Date(now - s * 1000));
      pts.push(la ? { az: la.az, el: la.el } : null);
    }
    sat.trail = pts;
  }
}

/* Recalcular estelas cuando el observador queda fijado (y luego periódicamente) */
function onObserverFixed() {
  computeTrails();
  if (!trailTimer) trailTimer = setInterval(computeTrails, 30000);
}

/* ── Dibujo en el visor ── */
function drawSatellites(ctx, time) {
  for (const sat of SATELLITES) {
    drawTrail(ctx, sat);
    if (!sat.visible) continue;

    const p = projectAzEl(sat.az, sat.el);
    if (p.r > App.visorRadius * 1.1) continue;

    // punto de tinta intermitente con anillo de pulso
    const blink = 0.55 + 0.45 * Math.sin(time * 6);
    const pulse = (time % 1.6) / 1.6;

    ctx.strokeStyle = sat.color;
    ctx.globalAlpha = (1 - pulse) * 0.6;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6 + pulse * 16, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = blink;
    ctx.fillStyle = sat.color;
    ctx.shadowColor = sat.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // etiqueta de terminal antigua
    ctx.font = "13px 'IBM Plex Mono', 'Courier New', monospace";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = sat.color;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 3;
    ctx.fillText(`${sat.name} [ALT: ${Math.round(sat.altKm)}km]`, p.x + 12, p.y - 10);
    ctx.fillText(`AZ ${Math.round(sat.az)}° · EL ${Math.round(sat.el)}°`, p.x + 12, p.y + 6);
    ctx.shadowBlur = 0;
  }
}

function drawTrail(ctx, sat) {
  if (!sat.trail.length) return;
  ctx.strokeStyle = sat.color;
  ctx.lineWidth = 1;

  let started = false;
  ctx.beginPath();
  for (let i = 0; i < sat.trail.length; i++) {
    const pt = sat.trail[i];
    if (!pt || pt.el < -8) { started = false; continue; }
    const p = projectAzEl(pt.az, pt.el);
    if (p.r > App.visorRadius * 1.15) { started = false; continue; }
    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
    else ctx.lineTo(p.x, p.y);
  }
  ctx.globalAlpha = 0.35;
  ctx.setLineDash([2, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/* ── Panel de contactos orbitales ── */
function updateSatPanel() {
  const list = document.getElementById('sat-list');
  if (!list) return;
  list.innerHTML = SATELLITES.map((sat) => {
    const status = sat.visible
      ? `<span style="color:${sat.color}">▲ VISIBLE</span>`
      : '<span class="opacity-50">▼ BAJO HORIZONTE</span>';
    return `<div>${sat.name} · ALT ${Math.round(sat.altKm)}km · ${status}</div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', initOrbits);
