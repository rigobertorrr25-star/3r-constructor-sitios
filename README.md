# 3R — Tienda de páginas web

Tienda donde el cliente **compra una página web hecha por ti**: elige un paquete, cuenta de su negocio,
sigue el avance de su pedido y recibe el enlace de su página. Tú lo gestionas desde un panel y construyes
la página con el editor visual. Monolito modular: API en NestJS 12, frontend en Next.js 16 (Tailwind 4) y
PostgreSQL con Prisma 7.

## Estructura

```
apps/
  web/            frontend (Next.js)
  api/            backend (NestJS + Prisma)
    prisma/       schema.prisma, migraciones y seed
    src/          módulos: auth, users, audit, admin, prisma, health
    test/         pruebas de integración (node:test)
packages/
  editor/ ui/ types/ config/    (vacíos por ahora)
design/
  REFERENCIA-LOVABLE.md         sistema visual de referencia
  logo/                         logo 3R (negro y blanco)
sites/
  caprichos/                    tienda de Caprichos (Vite + React), proyecto aparte
```

Las carpetas de `sites/` son proyectos independientes: no forman parte de los workspaces de npm. Se instalan y
corren desde su propia carpeta (`cd sites/caprichos && npm install && npm run dev`).

## Cómo funciona

- **Visitante:** ve la portada con paquetes, trabajos realizados y preguntas frecuentes.
- **Cliente:** crea cuenta, pide un paquete (formulario de su negocio) y sigue el pedido en `/dashboard`: estado,
  pago, conversación con el equipo y, al final, el enlace de su página.
- **Equipo (rol ADMIN):** en `/admin` gestiona pedidos (estado, pago recibido, mensajes y notas internas),
  crea el sitio del cliente y lo abre en el editor, edita los paquetes y los ejemplos del portafolio.
- **Pagos:** por ahora manuales (el equipo marca lo recibido). Stripe queda para después.
- **Publicación:** desde el pedido o desde el editor, el equipo publica el sitio del cliente en su propia dirección
  (`nombre.localhost:3000` en desarrollo, `nombre.tudominio.com` en producción). Puede usar esa dirección como enlace de entrega.

### Volverte administrador

Nadie se vuelve ADMIN desde la web. Regístrate en `/registro` y luego, en una terminal:

```bash
npm run make-admin -w api -- tucorreo@ejemplo.com
```

Cierra sesión y vuelve a entrar. Verás el enlace **Administración**.

### Textos y precios

Los paquetes que trae el seed (Esencial $350.000, Negocio $650.000, Completa $1.500.000 COP, con mensualidad
opcional de $60.000, $120.000 y $200.000) son **de ejemplo**: se editan en `/admin/paquetes`. Las instrucciones de pago que ve el cliente se cambian con
`PAYMENT_INSTRUCTIONS` (ver `.env.example`). Las preguntas frecuentes están en `apps/web/app/page.tsx`.

## Publicación de sitios

1. **Publicar** genera, para cada página, un HTML con CSS en línea (responsive) a partir del documento del editor. Todo
   el texto se escapa, solo se admiten los tipos de componente conocidos, y los enlaces e imágenes se limitan a
   `http(s)`, `mailto`, `tel`, anclas y rutas propias. Los colores y números se validan.
2. Los archivos se guardan por publicación en `PUBLISH_DIR` (por defecto `%LOCALAPPDATA%\3r-published`) y se conservan
   las últimas 5. La interfaz `PublishStorage` (`apps/api/src/publishing/storage.ts`) permite cambiar a S3 / R2.
3. Se sirven en `GET /api/v1/public/sites/:etiqueta/*`. `apps/web/proxy.ts` reconoce `etiqueta.<SITES_ROOT_HOST>` y
   reescribe la petición a `/s/etiqueta/…`; `localhost:3000/s/etiqueta` funciona como alternativa sin DNS.
4. Cada página publicada lleva `Content-Security-Policy` con `sandbox`. El único permiso que suma es
   `allow-scripts`, a propósito sin `allow-same-origin` — necesario para que el mapa (Google Maps embed) se
   dibuje, pero como la página sandboxeada tiene un origen opaco, ese script nunca puede leer las cookies de la
   aplicación ni llamarla como si fuera un usuario real, aunque corra.

Variables (`.env.example`): `SITES_ROOT_HOST`, `SITES_URL_TEMPLATE`, `PUBLISH_DIR`.

**Para producción** hace falta un dominio propio con DNS comodín (`*.tudominio.com`) apuntando al servidor web, y
`SITES_ROOT_HOST` / `SITES_URL_TEMPLATE` con ese dominio. Los dominios propios del cliente (`www.sunegocio.com`) quedan pendientes.

## Puesta en marcha (desarrollo)

Requiere Node 20+ y npm.

```bash
npm install
npm run dev:db -w api         # Postgres local (sin Docker), deja esta terminal abierta
npm run db:generate -w api    # genera el cliente de Prisma
npm run db:migrate -w api     # aplica migraciones
npm run db:seed -w api        # planes Starter/Business/Agency y plantillas
npm run dev -w api            # API en http://localhost:3001/api/v1
npm run dev -w web            # web en http://localhost:3000
npm test -w api               # requiere dev:db y `npm run build -w api`
```

`apps/api/.env` (ignorado por git) apunta al Postgres local. Copia `.env.example` si no existe.

## Correos

Registro (bienvenida + verificar correo, y aviso al equipo), recuperar contraseña y avisos de pedidos
(nuevo pedido y mensajes al equipo; estado, pago y entrega al cliente) — todo en `apps/api/src/email`.

- **Sin `RESEND_API_KEY`** (por defecto): los correos no se mandan de verdad, quedan en memoria y se
  pueden ver en `GET /api/v1/dev/emails` (o `?to=correo@ejemplo.com`) mientras la API corra. Útil para
  probar sin depender de una cuenta real. Esa ruta deja de existir en cuanto se configura la llave.
- **Con `RESEND_API_KEY`** (de [resend.com](https://resend.com)): se manda de verdad con `EMAIL_FROM`.
  Sin verificar un dominio propio en Resend, solo se puede usar `onboarding@resend.dev` como remitente y
  puede que solo deje mandar a tu propio correo de la cuenta de Resend — verificar un dominio lo desbloquea.
- `ADMIN_EMAIL`: a quién le llegan los avisos de cuentas nuevas, pedidos nuevos y mensajes de clientes.
- Pedir una página exige el correo verificado (candado en `OrdersService.create`, código `EMAIL_NOT_VERIFIED`).

## Usar una base en la nube (Neon)

1. Crea un proyecto en Neon y una rama/base de **desarrollo**.
2. Pon su cadena en `DATABASE_URL` de `apps/api/.env` (nunca en git).
3. `npm run db:deploy -w api` aplica las migraciones ya creadas y `npm run db:seed -w api` carga los datos base.

## Publicar en internet (producción)

Cuatro servicios, cada uno con cuenta gratis, y tu propio dominio:

1. **Base de datos — [Neon](https://neon.tech).** Crea un proyecto (rama de **producción**, no la de desarrollo)
   y copia su cadena de conexión.
2. **API — [Render](https://render.com).** *New → Blueprint*, conecta este repositorio de GitHub — detecta
   `render.yaml` solo. Te va a pedir rellenar: `DATABASE_URL` (de Neon), `WEB_ORIGIN` (tu dominio, con `https://`),
   `ADMIN_EMAIL`, `SITES_ROOT_HOST` (tu dominio) y `SITES_URL_TEMPLATE` (`https://{label}.tudominio.com`).
   `RESEND_API_KEY`/`EMAIL_FROM` y las 4 de R2 son opcionales — sin ellas, los correos quedan en modo de
   prueba y los sitios publicados se guardan en el disco de Render (que se borra en cada reinicio, ver más abajo).
   Termina con la URL de tu API, algo como `https://3r-api.onrender.com`.
3. **Sitio (frontend) — [Vercel](https://vercel.com).** *New Project*, mismo repositorio, con **Root Directory**
   en `apps/web`. Variable `API_URL` = tu URL de Render + `/api/v1` (ej. `https://3r-api.onrender.com/api/v1`).
4. **Dominio — en Cloudflare (DNS del dominio):** agrega tu dominio en el proyecto de Vercel; te da los registros
   DNS a crear (normalmente un `A` en la raíz y un `CNAME` en `www`). Agrega también `*.tudominio.com` como
   dominio del mismo proyecto de Vercel, con su propio `CNAME` — así cada sitio de cliente
   (`etiqueta.tudominio.com`) llega a la misma app. **En Cloudflare, esos registros van en modo "solo DNS"
   (nube gris, no naranja)** — con el proxy de Cloudflare activado (naranja), Vercel no puede emitir el
   certificado HTTPS.

### Sitios publicados, imágenes y video en producción (Cloudflare R2)

El disco de Render **no es permanente**: cada reinicio o nuevo despliegue borra lo que se guardó ahí, y con eso
desaparecerían los sitios ya publicados y las imágenes/videos subidos desde el editor. Para producción, activa
Cloudflare R2 (S3-compatible, plan gratis): crea un bucket y un token con permiso de lectura/escritura, activa su
acceso público (Settings → Public access → r2.dev, o un dominio propio) y pon las 5 variables `R2_*` en Render (ver
`.env.example`) — la quinta, `R2_PUBLIC_BASE_URL`, es la dirección pública que te dio ese paso. Con esas puestas,
`PublishingModule` y `MediaModule` usan R2 solo; sin ellas, ambos siguen usando disco local (perfecto para
desarrollo). Para que el navegador pueda subir directo a R2 (así un video no pasa por el servidor de Next, que
tiene un límite de tamaño mucho más chico), el bucket necesita su propio permiso CORS — en el bucket → Settings →
CORS Policy, agrega:

```json
[{ "AllowedOrigins": ["https://tudominio.com"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"] }]
```

## Estado

Hecho (todo con pruebas: 98 de API, 23 del editor y recorridos completos en un Chrome real):

- **Base:** monorepo, esquema (paquetes, pedidos, portafolio, sitios, páginas, versiones, publicaciones…), migraciones y seed.
- **Cuentas:** registro/login/refresh con rotación, sesión en cookies `httpOnly`, roles USER/ADMIN, auditoría,
  recuperar contraseña y verificar correo por enlace (ver "Correos" más abajo). Los endpoints de `/auth` tienen
  límite de intentos por IP (`@nestjs/throttler`) para frenar fuerza bruta y registros en cadena.
- **Tienda:** portada con paquetes, portafolio y preguntas frecuentes, botón flotante de WhatsApp; pedido con datos
  del negocio (exige correo verificado); seguimiento del cliente (estado, pago, conversación); panel del equipo
  (pedidos, paquetes, portafolio, sitios).
- **Editor visual** (`/editor/[siteId]`): arrastrar y soltar, propiedades, responsive, deshacer/rehacer, vista previa,
  guardado automático con recuperación sin conexión, versiones y varias páginas. Lógica pura en `apps/web/lib/editor`.
  Imagen, video y mapa (dirección → Google Maps embebido, sin API key) ya se pueden usar. Imagen y video se suben
  desde el computador (botón "Subir" en el panel de propiedades) — el navegador sube el archivo directo a su
  destino final (R2 o, en desarrollo, la misma API) con un enlace firmado de un solo uso, sin pasar por el
  servidor de Next.
- **Publicación:** HTML estático saneado en la dirección propia de cada cliente, con menú, sitemap y robots.

Pendiente: edición de texto directamente en el lienzo, componentes galería/formulario, dominios propios del
cliente con SSL, Stripe y webhooks, Redis/BullMQ (la publicación y los correos hoy son inmediatos y no usan cola).

Notas de seguridad para producción: el renovador de tokens del proxy comparte una renovación por proceso
(válido con una sola instancia web).

## Notas técnicas

- La API es **ESM** (Nest 12): los imports relativos llevan extensión `.js`.
- TypeScript **6** (el CLI de Nest aún no funciona con 7).
- Los estados de las tablas son `VARCHAR` y se validan en código.
- El refresh token nunca se guarda en claro: solo su hash SHA-256. Reusar uno ya rotado revoca todas las sesiones.
