# El Telescopio Digital (TelescopioAR)

Telescopio de Realidad Aumentada para navegantes modernos. Alinea un firmamento
virtual sobre la cámara en vivo de tu dispositivo, rastrea la ISS y el Hubble en
tiempo real con el algoritmo **SGP4** (`satellite.js`) sobre datos TLE reales, y
desbloquea un radiomensaje pirata si logras mantener un satélite en la mira.

SPA 100% frontend: sin backend, sin build step, sin dependencias instaladas.

## Correr en local

```powershell
python -m http.server 8123
# abrir http://localhost:8123
```

En laptop la app funciona en **modo manual**: arrastra con el mouse para girar la
vista (azimut) e inclinarla (elevación).

## Probar en el móvil (modo AR)

La cámara, el giroscopio y la geolocalización **exigen HTTPS** (localhost no
cuenta desde el móvil). Dos opciones:

- **Vercel** (recomendado): `npx vercel deploy` desde la carpeta del proyecto, o
  el deploy ya publicado.
- **ngrok**: `ngrok http 8123` y abrir la URL `https://...` en el móvil.

En iOS, el permiso del giroscopio se solicita al tocar "INICIAR TRAVESÍA"
(requisito de Safari: debe ser tras un gesto del usuario).

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html` | Layout, video de cámara, canvas, paneles, overlay de inicio y terminal |
| `css/styles.css` | Tema latón/fósforo, grano, scanlines, animaciones de revelado |
| `js/starfield.js` | Estado global, proyección Az/El → canvas, visor, brújula, 150 estrellas |
| `js/sensors.js` | Cámara trasera, `deviceorientation`, geolocalización, fallback de arrastre |
| `js/orbits.js` | TLEs de ISS/Hubble, propagación SGP4 por frame, estelas de 15 min |
| `js/game.js` | Mira, sincronización de 5 s, terminal de interceptación, audio Web Audio |
| `PITCH.md` | Guion de 90 s para los jueces, coreografía de demo y plan B |

## Actualizar los TLE

Los TLE embebidos en `js/orbits.js` son de julio de 2026. Si la posición se ve
rara, reemplázalos con datos frescos de
[Celestrak](https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle).
