# Sextant (El Telescopio Digital)

La raíz del sitio es solo la portada. El visor —cámara, cielo, ISS, Hubble—
sigue en el repositorio y no se puede abrir desde la interfaz.

Para volver a publicarlo: en `js/config.js`, pon `visor: true`.
Con eso `/instrument.html` deja de redirigir a la portada. Para que la raíz
sea el visor otra vez, sustituye `index.html` por `instrument.html` y quita
el script que redirige.

Telescopio de Realidad Aumentada. Alinea un firmamento virtual sobre la cámara
en vivo, rastrea la ISS y el Hubble en tiempo real con **SGP4** (`satellite.js`)
sobre datos TLE, y abre un despacho de demo si mantienes un satélite en la mira.

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
| `index.html` | Portada. No enlaza al visor |
| `instrument.html` | Visor completo. Redirige a `/` mientras `visor` es false |
| `js/config.js` | Interruptor `visor` para volver a publicar el radar |
| `css/styles.css` | Papel, tinta y latón. Serif para los títulos, sans para las lecturas |
| `js/starfield.js` | Estado global, proyección Az/El → canvas, visor, brújula, 150 estrellas |
| `js/sensors.js` | Cámara trasera, `deviceorientation`, geolocalización, fallback de arrastre |
| `js/orbits.js` | TLEs de ISS/Hubble, propagación SGP4 por frame, estelas de 15 min |
| `js/game.js` | Mira, sincronización de 5 s, terminal de interceptación, audio Web Audio |
| `PITCH.md` | Guion de 90 s para los jueces, coreografía de demo y plan B |

## Actualizar los TLE

Los TLE embebidos en `js/orbits.js` son de julio de 2026. Si la posición se ve
rara, reemplázalos con datos frescos de
[Celestrak](https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle).
