/* El visor (radar, cámara, cielo) está apagado.
   Para volver a publicarlo: pon visor en true.
   /instrument.html y /slide-qr.html dejan de redirigir a la portada.
   Para que la raíz sea el visor otra vez, sustituye index.html por instrument.html
   y quita el script que redirige. */
window.SEXTANT = Object.freeze({ visor: false });
