# Asistencia con QR (`asistencia/`)

Reglas generales de trabajo (iguales en todos los proyectos de Rigoberto): ver `docs/claude/instrucciones-globales.md`
(se cargan desde el CLAUDE.md de la raíz).

## Estado (actualízalo cuando algo cambie: otras sesiones no recuerdan lo que se habló)

- Asistencia con QR (28 sep 2026): sistema **aparte** de la tienda en `asistencia/` (ver su README). Rigoberto pidió
  que no aparezca nada en 3rpaginas.com: no enlazarlo desde la tienda ni compartir base, clave o despliegue. Usa el estilo
  3R y el león. Primer negocio: Azul Caribe Lounge (11 empleados; turnos 8am–3pm, 11am–6pm, 2pm–9pm). Publicado en
  https://3r-constructor-sitios.vercel.app (proyecto propio de Vercel, Root Directory `asistencia`; base en el proyecto
  ASISTENCIA de Neon). El turno no se asigna por empleado: se deduce de la hora de llegada (turnos del negocio en
  el panel). Cada empleado crea su propio PIN la primera vez que escanea. En español e inglés (botón ES | EN; los jefes de
  Rigoberto son de EE. UU.): todo texto nuevo va en los dos idiomas en `asistencia/lib/i18n.ts`. Los jefes de
  cada negocio tienen acceso de solo lectura (sección "Jefes" del panel; entran con su clave en `/entrar`). Empleados cargados y tablet con QR listos (29 sep 2026).
- Diseño (4 nov 2026, Rigoberto, con un video de referencia «Admin Dashboard V2»): estilo **vidrio**: fondo azul
  petróleo con brillos (`--gradient-page`, en `body::before`), tarjetas de vidrio claro con letras oscuras (`card` en
  `components/ui.tsx`), vidrio oscuro para la barra de arriba y el menú lateral (`glassDark`), botón principal oscuro
  (`darkButton`), íconos `lucide-react` y tarjetas que suben al pasar el mouse (`.lift`). Panel del negocio: menú lateral
  (en celular, pestañas) con `?vista=reporte|empleados|turnos|tablet|jefes`, saludo según la hora, «En turno ahora»,
  4 tarjetas con ícono, gráfica de horas por día y anillo de puntualidad. Antes (3 nov) fue una versión clara y antes oscura.
  En el Excel y el panel ya no aparece "corregido a mano" (27 oct 2026, Rigoberto); por dentro se sigue guardando.
- Avatares (3 nov 2026, Rigoberto): cada empleado tiene un dibujo automático, estilo «Adventurer» de DiceBear
  (Lisa Wischofsky, **CC BY 4.0**: el crédito va al pie del panel y del celular, no quitarlo). Sale del id,
  `employees.avatar_variant` («Otro avatar» lo sube) y hombre/mujer: `employees.avatar_gender` ('m'/'f') o, si está
  vacío, se adivina por el primer nombre (`lib/gender.ts`, nombres comunes de Colombia). Lo sirve `/avatar/{id}[-n]-{m|f}`
  sin guardar imágenes; peinados cortos para hombres y largos para mujeres en `app/avatar/[seed]/route.ts`.
- Marcar en el celular (4 nov 2026, Rigoberto, video de referencia «OTP Verification V2»): el PIN va en 4 cuadritos
  (un solo campo invisible por debajo; el que sigue se ilumina en coral `#ff6b4a`), se marca solo al completar los 4,
  mientras verifica los cuadros se juntan en uno que gira y al terminar aparece un cuadro verde con chulito y brillo
  verde (clases `pin-*`, `success-*` en `app/globals.css`). Mensaje chistoso según la hora (`punchMood` en
  `lib/report.ts`): llegó tarde / temprano / a tiempo, o salió antes / con tiempo extra (+30 min) / a tiempo; varios
  textos por caso (`mood*` en `lib/i18n.ts`, se elige uno al azar).
- Vercel (3 nov 2026): el `ignoreCommand` publica también si no encuentra la publicación anterior (antes, cuando la
  última publicación quedaba a más de ~10 cambios, Vercel marcaba "falló" sin compilar).

## Este proyecto

- App independiente con su propio `package.json`; no es workspace del monorepo. Detalle en `asistencia/README.md`.
