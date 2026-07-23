/* ═══════════════════════════════════════════════════════════════
   worldmap.js — Carta orbital: mapamundi 2D (canvas equirectangular)
   con el punto subsatélite parpadeante de la ISS, su traza de tierra,
   huella de cobertura y el marcador del navío, calculados por el
   motor orbital (SGP4 · satellite.js).
   ═══════════════════════════════════════════════════════════════ */

'use strict';

(function () {
  /* ── Contornos simplificados de los continentes en [lon, lat] ──
     Trazo grueso estilo carta náutica: reconocible, no cartográfico. */
  const LAND = [
    // Norteamérica
    [[-168, 65], [-160, 71], [-140, 70], [-125, 70], [-110, 68], [-95, 68],
     [-82, 68], [-75, 73], [-62, 60], [-65, 50], [-60, 47], [-70, 42],
     [-75, 35], [-81, 25], [-97, 25], [-98, 18], [-106, 20], [-114, 30],
     [-124, 40], [-124, 48], [-132, 56], [-150, 59], [-166, 60]],
    // Groenlandia
    [[-45, 60], [-52, 66], [-55, 72], [-45, 80], [-25, 82], [-20, 76],
     [-30, 68], [-42, 61]],
    // Sudamérica
    [[-81, 6], [-77, 8], [-70, 12], [-60, 10], [-51, 0], [-50, -2],
     [-35, -6], [-38, -13], [-48, -25], [-58, -35], [-64, -42], [-70, -52],
     [-75, -52], [-73, -45], [-71, -33], [-71, -18], [-78, -8], [-81, 0]],
    // África
    [[-17, 15], [-16, 21], [-10, 28], [0, 32], [10, 34], [11, 37], [20, 32],
     [28, 31], [33, 27], [35, 24], [43, 12], [51, 12], [45, 5], [41, -3],
     [40, -11], [35, -20], [27, -33], [20, -35], [17, -29], [13, -18],
     [9, -2], [10, 4], [-2, 5], [-10, 6], [-16, 12]],
    // Europa + Asia (bloque continental principal)
    [[-10, 37], [-9, 44], [0, 49], [2, 51], [-4, 58], [8, 63], [20, 70],
     [35, 71], [55, 71], [75, 73], [100, 77], [130, 73], [160, 70],
     [180, 66], [180, 61], [160, 60], [143, 52], [135, 45], [127, 42],
     [122, 31], [110, 21], [105, 10], [103, 1], [98, 9], [92, 21],
     [88, 22], [80, 10], [77, 8], [72, 20], [66, 25], [57, 25], [50, 30],
     [48, 30], [43, 40], [36, 36], [28, 41], [20, 40], [13, 45], [8, 44],
     [3, 43], [-2, 37]],
    // Australia
    [[113, -22], [114, -35], [123, -34], [130, -32], [137, -35], [141, -38],
     [147, -38], [150, -37], [153, -28], [146, -19], [142, -11], [137, -12],
     [130, -12], [124, -16], [114, -22]],
    // Antártida (banda inferior)
    [[-180, -78], [-180, -71], [-120, -74], [-60, -77], [0, -70], [60, -67],
     [120, -66], [180, -70], [180, -78]],
    // Islas Británicas
    [[-5, 50], [-3, 54], [-6, 58], [-8, 55], [-6, 51]],
    // Japón
    [[140, 35], [142, 40], [141, 45], [136, 36], [131, 32], [135, 34]],
    // Madagascar
    [[44, -12], [50, -15], [49, -25], [45, -25], [43, -18]],
    // Nueva Zelanda
    [[173, -35], [178, -38], [174, -41], [168, -46], [167, -44], [172, -40]],
  ];

  const ISS_NAME = 'ISS';
  const TRACK_MIN_BACK = 45;   // minutos de traza pasada
  const TRACK_MIN_FWD = 45;    // minutos de traza futura
  const TRACK_STEP_SEC = 60;
  const EARTH_R = 6371;        // radio terrestre medio (km)
  const D2R = Math.PI / 180;

  let panel, canvas, ctx, readout;
  let W = 0, H = 0;
  let track = [];
  let lastTrackCalc = 0;

  /* ── Proyección equirectangular: (lon, lat) → (x, y) ── */
  function project(lon, lat) {
    return {
      x: (lon + 180) / 360 * W,
      y: (90 - lat) / 180 * H,
    };
  }

  /* ── Punto subsatélite en un instante (mismo motor SGP4) ── */
  function subPoint(satrec, date) {
    const pv = satellite.propagate(satrec, date);
    if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
    const gmst = satellite.gstime(date);
    const geo = satellite.eciToGeodetic(pv.position, gmst);
    let lon = satellite.radiansToDegrees(geo.longitude);
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return { lon, lat: satellite.radiansToDegrees(geo.latitude) };
  }

  function issSat() {
    return (typeof SATELLITES !== 'undefined')
      ? SATELLITES.find((s) => s.name === ISS_NAME)
      : null;
  }

  /* ── Recalcular la traza de tierra (órbita ± 45 min) ── */
  function computeTrack() {
    const sat = issSat();
    if (!sat || !sat.satrec) return;
    const now = Date.now();
    const pts = [];
    for (let s = -TRACK_MIN_BACK * 60; s <= TRACK_MIN_FWD * 60; s += TRACK_STEP_SEC) {
      pts.push(subPoint(sat.satrec, new Date(now + s * 1000)));
    }
    track = pts;
    lastTrackCalc = now;
  }

  /* ── Inicialización ── */
  function initMap() {
    panel = document.getElementById('panel-map');
    canvas = document.getElementById('map-canvas');
    readout = document.getElementById('map-readout');
    if (!panel || !canvas) return;
    ctx = canvas.getContext('2d');

    W = canvas.width;
    H = canvas.height;

    const toggle = document.getElementById('map-toggle');
    if (toggle) toggle.addEventListener('click', togglePanel);
    // También se pliega tocando la cabecera
    const head = panel.querySelector('.map-head');
    if (head) head.addEventListener('click', (e) => {
      if (e.target.id !== 'map-toggle') togglePanel();
    });

    // En teléfono arranca plegada para no tapar el visor
    if (window.matchMedia('(max-width: 700px)').matches) {
      panel.classList.add('collapsed');
      if (toggle) toggle.textContent = '▸';
    }

    computeTrack();
    requestAnimationFrame(loop);
  }

  function togglePanel() {
    panel.classList.toggle('collapsed');
    const toggle = document.getElementById('map-toggle');
    if (toggle) toggle.textContent = panel.classList.contains('collapsed') ? '▸' : '▾';
  }

  /* ── Bucle de dibujo ── */
  function loop(t) {
    requestAnimationFrame(loop);
    if (!ctx || panel.classList.contains('collapsed')) return;

    const time = t / 1000;
    if (Date.now() - lastTrackCalc > 15000) computeTrack();

    drawOcean();
    drawGraticule();
    drawLand();
    drawTerminator();
    drawFootprints();
    drawTrack();
    drawObserver();
    drawSats(time);
    updateReadout();
  }

  function drawOcean() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#d9e0d0');
    g.addColorStop(0.5, '#c5d0c8');
    g.addColorStop(1, '#d4cbb0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGraticule() {
    ctx.strokeStyle = 'rgba(26, 42, 92, 0.18)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = (lon + 180) / 360 * W;
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = (90 - lat) / 180 * H;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();

    // ecuador remarcado
    ctx.strokeStyle = 'rgba(74, 58, 24, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
    ctx.stroke();
  }

  function drawLand() {
    ctx.lineJoin = 'round';
    for (const poly of LAND) {
      ctx.beginPath();
      for (let i = 0; i < poly.length; i++) {
        const p = project(poly[i][0], poly[i][1]);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(90, 60, 30, 0.42)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(28, 16, 8, 0.55)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  /* ── Sombra nocturna aproximada (terminador día/noche) ── */
  function drawTerminator() {
    const now = new Date();
    // Longitud subsolar ≈ -15° por cada hora UTC desde mediodía
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const sunLon = -15 * (utcHours - 12);
    // Declinación solar aproximada según el día del año
    const dayOfYear = Math.floor((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 0))) / 86400000);
    const sunLat = 23.44 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.fillStyle = 'rgba(40, 28, 14, 0.28)';
    ctx.beginPath();
    let started = false;
    for (let lon = -180; lon <= 180; lon += 2) {
      const H0 = (lon - sunLon) * Math.PI / 180;
      const lat = Math.atan(-Math.cos(H0) / Math.tan(sunLat * Math.PI / 180)) * 180 / Math.PI;
      const p = project(lon, lat);
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    if (sunLat >= 0) { ctx.lineTo(W, 0); ctx.lineTo(0, 0); }
    else { ctx.lineTo(W, H); ctx.lineTo(0, H); }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ── Punto de destino sobre la esfera a distancia angular c y rumbo brg ── */
  function destPoint(latDeg, lonDeg, c, brgDeg) {
    const lat1 = latDeg * D2R, lon1 = lonDeg * D2R, brg = brgDeg * D2R;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(c) + Math.cos(lat1) * Math.sin(c) * Math.cos(brg));
    const lon2 = lon1 + Math.atan2(
      Math.sin(brg) * Math.sin(c) * Math.cos(lat1),
      Math.cos(c) - Math.sin(lat1) * Math.sin(lat2),
    );
    let lon = lon2 / D2R;
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return { lat: lat2 / D2R, lon };
  }

  /* ── Huella de cobertura: región desde la que el satélite está sobre
     el horizonte (radio angular = acos(Re / (Re + altitud))) ── */
  function drawFootprints() {
    if (typeof SATELLITES === 'undefined') return;
    for (const sat of SATELLITES) {
      if (!sat.altKm || sat.lonDeg === undefined) continue;
      const c = Math.acos(EARTH_R / (EARTH_R + sat.altKm));  // radio angular (rad)

      const pts = [];
      let wraps = false;
      let prevX = null;
      for (let b = 0; b <= 360; b += 6) {
        const q = destPoint(sat.latDeg, sat.lonDeg, c, b);
        const p = project(q.lon, q.lat);
        if (prevX !== null && Math.abs(p.x - prevX) > W / 2) wraps = true;
        prevX = p.x;
        pts.push(p);
      }

      // relleno tenue solo si la huella no cruza el meridiano ±180 (evita artefactos)
      if (!wraps) {
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.fillStyle = sat.color;
        ctx.globalAlpha = 0.07;
        ctx.fill();
      }

      // contorno (partido en el salto de meridiano)
      ctx.strokeStyle = sat.color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let prev = null;
      for (const p of pts) {
        if (prev && Math.abs(p.x - prev.x) > W / 2) { ctx.stroke(); ctx.beginPath(); prev = null; }
        if (!prev) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        prev = p;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /* ── Marcador del observador (navío) según la geolocalización ── */
  function drawObserver() {
    if (typeof App === 'undefined') return;
    const o = App.state && App.state.observer;
    if (!o || !o.fixed) return;
    const p = project(o.lon, o.lat);

    // diamante de latón
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#c9a227';
    ctx.strokeStyle = '#1c1008';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -4); ctx.lineTo(4, 0); ctx.lineTo(0, 4); ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.font = "10px 'IBM Plex Mono', 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#1a2a5c';
    ctx.shadowColor = 'rgba(240, 226, 196, 0.85)';
    ctx.shadowBlur = 2;
    ctx.fillText('NAVÍO', p.x, p.y + 4);
    ctx.shadowBlur = 0;
  }

  /* ── Traza de tierra de la ISS (línea punteada, con corte en ±180) ── */
  function drawTrack() {
    if (track.length < 2) return;
    ctx.strokeStyle = 'rgba(42, 61, 143, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    let prev = null;
    for (const pt of track) {
      if (!pt) { prev = null; continue; }
      const p = project(pt.lon, pt.lat);
      if (prev && Math.abs(p.x - prev.x) > W / 2) prev = null;  // salto de meridiano
      if (!prev) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
      prev = p;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ── Puntos subsatélite parpadeantes + enlace de visibilidad ── */
  function drawSats(time) {
    if (typeof SATELLITES === 'undefined') return;
    const obs = (typeof App !== 'undefined' && App.state) ? App.state.observer : null;

    for (const sat of SATELLITES) {
      if (sat.lonDeg === undefined) continue;
      const p = project(sat.lonDeg, sat.latDeg);
      const isISS = sat.name === ISS_NAME;

      // enlace navío ↔ satélite cuando está sobre el horizonte del observador
      if (sat.visible && obs && obs.fixed) {
        const po = project(obs.lon, obs.lat);
        if (Math.abs(po.x - p.x) < W / 2) {
          ctx.strokeStyle = sat.color;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 0.8;
          ctx.setLineDash([1, 2]);
          ctx.beginPath();
          ctx.moveTo(po.x, po.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }

      const blink = 0.5 + 0.5 * Math.sin(time * 6);
      const pulse = (time % 1.5) / 1.5;

      // anillo de pulso expansivo
      ctx.strokeStyle = sat.color;
      ctx.globalAlpha = (1 - pulse) * 0.7;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + pulse * (isISS ? 11 : 7), 0, Math.PI * 2);
      ctx.stroke();

      // punto central intermitente
      ctx.globalAlpha = 0.55 + 0.45 * blink;
      ctx.fillStyle = sat.color;
      ctx.shadowColor = sat.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isISS ? 3.2 : 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // etiqueta
      ctx.font = "11px 'IBM Plex Mono', 'Courier New', monospace";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = sat.color;
      ctx.shadowColor = 'rgba(240, 226, 196, 0.9)';
      ctx.shadowBlur = 2;
      let lx = p.x + 5;
      if (lx > W - 34) { ctx.textAlign = 'right'; lx = p.x - 5; }
      ctx.fillText(sat.name, lx, p.y - 3);
      ctx.shadowBlur = 0;
    }
  }

  function fmt(v, pos, neg) {
    return Math.abs(v).toFixed(1) + '°' + (v >= 0 ? pos : neg);
  }

  function updateReadout() {
    if (!readout) return;
    const sat = issSat();
    if (!sat || sat.lonDeg === undefined) return;
    const coords = `ISS  ${fmt(sat.latDeg, 'N', 'S')}  ${fmt(sat.lonDeg, 'E', 'O')}`;
    const alt = sat.altKm ? ` · ${Math.round(sat.altKm)}km` : '';
    readout.textContent = coords + alt + (sat.visible ? ' ▲' : '');
    readout.classList.toggle('visible-now', !!sat.visible);
  }

  document.addEventListener('DOMContentLoaded', initMap);
})();
