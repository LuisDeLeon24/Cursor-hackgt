# PITCH — El Telescopio Digital (TelescopioAR)

Guion de 90 segundos para los jueces, con la coreografía de demo y el plan B.
Cada beat está diseñado con un principio de psicología de persuasión (entre corchetes).

---

## Guion de 90 segundos (estructura AIDA)

### Beat 1 — Gancho (0:00–0:10) [Atención + Contrast Effect]

*(Proyecta 3 segundos una captura de un mapa estelar estático cualquiera.)*

> "Así se ve el cielo en cualquier app de astronomía: un dibujo. Estático. Muerto."

*(Baja la laptop. Levanta el móvil con la app ya abierta apuntando al techo/cielo.)*

> "Esto, en cambio, está vivo."

### Beat 2 — Problema y autoridad (0:10–0:25) [Interés + Authority Bias]

> "Este es El Telescopio Digital: un telescopio de realidad aumentada. Usa el giroscopio
> y la cámara de este teléfono para alinear un firmamento virtual con el cielo real,
> y calcula — en este preciso segundo — la órbita de la Estación Espacial Internacional
> con **SGP4**, el mismo algoritmo de propagación orbital que usa **NORAD**, sobre
> datos **TLE reales de la NASA**. Sin backend. Todo corre aquí, en el navegador."

### Beat 3 — Demo en vivo (0:25–1:10) [Deseo + Availability Heuristic + Zeigarnik]

*(Gira lentamente el cuerpo buscando el satélite; los jueces ven la brújula girar.)*

> "La ISS está pasando sobre nosotros AHORA, a 27 000 kilómetros por hora y
> 420 kilómetros de altura. El telescopio me dice exactamente dónde: azimut, elevación,
> y su estela de los últimos 15 minutos."

*(Centra el satélite en la mira. Arranca la sincronización de 5 segundos.
 DEJA que la barra llegue a ~80% y saca la mira UN instante — tensión — y vuelve a fijarla.)*

> "Y si logras mantenerlo en la mira cinco segundos... interceptas su transmisión."

*(Se abre la terminal de fósforo verde: binario fluyendo, luego el mensaje pirata.)*

### Beat 4 — Cierre (1:10–1:30) [Acción + Peak-End Rule]

*(Lee el mensaje descifrado en voz alta, con teatralidad.)*

> "«Botín detectado. La tripulación de la Zarya esconde 400 toneladas de oro estelar.»
> Hace 300 años, un telescopio te decía dónde mirar.
> Hoy, El Telescopio Digital te dice qué pasa sobre tu cabeza — y lo convierte en un juego.
> Gracias, capitanes."

*(Termina SIEMPRE con el mensaje pirata en pantalla, nunca en un panel técnico.)*

---

## Principios aplicados (por si preguntan o para afinar)

| Momento | Principio | Por qué funciona |
|---|---|---|
| Mapa estático vs. AR en vivo | Contrast Effect | El "antes" aburrido hace vívido el "después" |
| "El algoritmo de NORAD, datos de la NASA" | Authority Bias | Credenciales técnicas verificables |
| "Pasa sobre nosotros AHORA a 27 000 km/h" | Availability Heuristic | Concreto, vívido, imposible de olvidar |
| Sincronización interrumpida al 80% | Zeigarnik Effect | La tarea incompleta genera tensión que pide cierre |
| Pico = interceptación; final = mensaje pirata | Peak-End Rule | Los jueces recuerdan el pico y el final, no el promedio |
| "Denle 'permitir' al giroscopio, iOS es celoso" | Pratfall Effect | Una imperfección admitida con humor humaniza y da confianza |

---

## Coreografía y preparación

1. **30 min antes**: abrir la URL HTTPS en el móvil, conceder cámara + giroscopio +
   posición UNA vez (los permisos quedan recordados). Brillo de pantalla al máximo.
2. **Timing orbital**: verificar en el panel CONTACTOS ORBITALES qué satélite estará
   VISIBLE a la hora del pitch. Si ninguno está sobre el horizonte, usar el modo
   manual: arrastrando se puede llevar la vista bajo el horizonte y "cazar" igual.
3. **Sonido**: activar el botón ♪ MAR antes de empezar — las olas de fondo ambientan
   sin necesidad de explicarlas.
4. **Roles** (2 tripulantes): uno narra, el otro sostiene el móvil y caza el satélite.
   Nunca narrar y cazar a la vez.

## Plan B (ensayado, no improvisado)

- **Falla la red del venue**: la app es 100% estática y ya está cargada; solo la
  primera carga necesita red (CDNs). Mantener la pestaña abierta desde antes.
- **Falla el giroscopio o los permisos**: botón ✋ MANUAL → se arrastra con el dedo.
  La frase de transición: *"y para los navegantes de escritorio, el telescopio también
  se gobierna a mano"* — suena a feature, no a fallback.
- **Falla el móvil completo**: demo en laptop en modo manual con la webcam de fondo.
  Ensayar esta ruta al menos una vez completa.

## Una línea de honestidad planificada [Pratfall]

Si algo tarda o pide permiso frente a los jueces:

> "iOS protege el giroscopio como un pirata protege su ron — denle 'permitir'."
