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

## Este proyecto

- App independiente con su propio `package.json`; no es workspace del monorepo. Detalle en `asistencia/README.md`.
