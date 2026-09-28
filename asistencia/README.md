# Asistencia 3R

Control de entrada y salida de empleados con código QR, para restaurantes. **Es un sistema aparte de la tienda 3R**
(3rpaginas.com): tiene su propia base de datos, su propia clave y su propio despliegue en Vercel. No comparte código,
datos ni direcciones con la tienda; solo el estilo visual (colores, tipografías y el león).

## Cómo funciona

- **Panel** (`/panel`, con clave): creas el negocio, sus **turnos** (por ejemplo 8:00–15:00, 11:00–18:00, 14:00–21:00) y
  agregas a cada empleado **solo con su nombre**. Ves el reporte por semana (horas, llegadas tarde y salidas temprano con
  5 minutos de gracia, jornadas sin salida), corriges o borras jornadas (queda rastro en `record_changes`), reinicias el
  PIN de quien lo olvide y descargas el reporte para Excel.
- **Turno de cada jornada:** no se asigna por empleado. Se deduce de la hora de llegada (el turno que empieza más cerca) y,
  si ya marcó la salida, también de la hora de salida: quien llega 9:45 y sale a las 3:00 p. m. queda en el de la mañana.
- **Tablet de la entrada** (`/tablet/{secreto}`, el enlace está en el panel): muestra un QR que cambia cada 30 segundos. El
  código se acepta unos 2 minutos, así que una foto del QR no sirve desde la casa. "Cambiar enlace" invalida la tablet anterior.
- **Empleado**: escanea el QR, toca su nombre (el celular lo recuerda) y pone su PIN. **La primera vez crea su propio PIN**
  (lo escribe dos veces) y en esa misma marcación queda su entrada. Con una jornada abierta marca la salida; si no, la
  entrada. Dos marcaciones en menos de 2 minutos se rechazan. Una entrada sin salida de más de 16 horas queda "sin salida"
  y la siguiente marcación abre otra jornada. 5 PIN equivocados seguidos bloquean a ese empleado 15 minutos.
- **Español e inglés:** botón ES | EN en todas las pantallas (panel, reporte, Excel, ingreso, tablet y celular). Se guarda
  en el navegador de cada persona; si nunca lo tocó, se usa el idioma de su navegador. Textos en `lib/i18n.ts`. El Excel en
  inglés usa coma y punto decimal (Excel de EE. UU.); en español, punto y coma y coma decimal.
- Todo en hora de Colombia. Las tablas se crean solas la primera vez que la app usa la base.

## Publicarla (una sola vez)

1. **Base de datos (Neon):** crea una base nueva, aparte de la de la tienda (en el mismo proyecto de Neon: *Databases →
   New database*, por ejemplo `asistencia`). Copia su cadena de conexión.
2. **Vercel:** *Add New → Project*, elige este mismo repositorio y en **Root Directory** pon `asistencia`. Antes de
   desplegar, agrega estas variables (*Environment Variables*):
   - `DATABASE_URL`: la cadena de la base del paso 1.
   - `ADMIN_PASSWORD`: la clave para entrar al panel. Cambiarla cierra las sesiones abiertas.
   - `SESSION_SECRET`: un texto largo al azar (40 letras y números, por ejemplo).
3. Despliega. La dirección queda como `algo.vercel.app`; si quieres una propia, se agrega en *Settings → Domains*.
4. Entra a `https://<tu dirección>/entrar`, crea el negocio, carga a los empleados y abre el enlace de la tablet en la
   tablet de la entrada.

## Desarrollo

```bash
cd asistencia
npm install
cp .env.example .env     # y pon una base local en DATABASE_URL
npm run dev              # http://localhost:3100
npm test                 # cálculos e ingreso; con TEST_DATABASE_URL también el flujo completo contra una base vacía
```

Tiene su propio `package-lock.json`: no es un workspace de la raíz, así que no cambia nada de la tienda al instalarse.
