# Asistencia 3R

Control de entrada y salida de empleados con código QR, para restaurantes. **Es un sistema aparte de la tienda 3R**
(3rpaginas.com): tiene su propia base de datos, su propia clave y su propio despliegue en Vercel. No comparte código,
datos ni direcciones con la tienda; solo el estilo visual (colores, tipografías y el león).

## Cómo funciona

- **Panel** (`/panel`, con clave): creas el negocio y agregas a cada empleado con un PIN de 4 números (no se repite en el
  negocio y no se guarda tal cual) y su turno. Ves el reporte por semana (horas, llegadas tarde con 5 minutos de gracia,
  jornadas sin salida), corriges o borras jornadas (queda rastro en `record_changes`) y descargas el reporte para Excel.
- **Tablet de la entrada** (`/tablet/{secreto}`, el enlace está en el panel): muestra un QR que cambia cada 30 segundos. El
  código se acepta unos 2 minutos, así que una foto del QR no sirve desde la casa. "Cambiar enlace" invalida la tablet anterior.
- **Empleado**: escanea el QR, se abre `/marcar/{negocio}?c=…` y pone su PIN. Con una jornada abierta marca la salida; si no,
  la entrada. Dos marcaciones en menos de 2 minutos se rechazan. Una entrada sin salida de más de 16 horas queda "sin salida"
  y la siguiente marcación abre otra jornada.
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
