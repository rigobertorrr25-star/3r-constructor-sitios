# Tienda 3R: 3rpaginas.com y plataforma empresarial (`apps/web` y `apps/api`)

Reglas generales de trabajo (iguales en todos los proyectos de Rigoberto): ver `docs/claude/instrucciones-globales.md`
(se cargan desde el CLAUDE.md de la raíz).

## Estado (actualízalo cuando algo cambie: otras sesiones no recuerdan lo que se habló)

- **Publicada en producción** en https://3rpaginas.com: base en Neon, API en Render, web en Vercel, archivos en
  Cloudflare R2 y correos con Resend. `main` es lo que está en vivo. API en Render: https://threer-api-79ux.onrender.com
  (plan gratis: se duerme sin uso; no lanzar dos deploys a la vez o `prisma migrate deploy` falla por el bloqueo).
- Política de privacidad en `/privacidad` (Ley 1581), completa. Datos del responsable en `RESPONSABLE` de
  `apps/web/app/privacidad/page.tsx`.
- Portada (26 sep 2026): botón "Ver paquetes" fijo arriba, sección "Lo que pasa hoy" (problema del cliente), león
  recortado en cuadrado y fundido con el fondo, globo de la mascota que se cierra al hacer scroll.
- **Muestras de venta** (21 oct 2026, pedido de Rigoberto): 10 negocios de la base sin página (Arepas Pues, Mi Palacio de las Papas, Joche Burger, Barber Prestige, Satio Café, LAGME; en Barranquilla Samue In, Kaliche Pizza Bar 82, Nonna Rosa, Barbudos) tienen una muestra en `3rpaginas.com/muestra/<slug>` (`lib/muestras.ts`, `components/muestra-view.tsx`). Nombre, dirección, horario, calificación y foto de fachada son los públicos de Google Maps; los productos son de ejemplo y sin precio; aviso arriba «Muestra hecha por 3R… No es su página oficial», noindex, sin sitemap ni enlaces. Pedido, turno o reserva van al WhatsApp del negocio; el bloque final, al de 3R. Si un negocio pide que se quite, se borra su entrada y su foto (`public/muestras/negocios`). Los mensajes para mandarlas están en el Excel de la base (hoja Mensajes), no en el repositorio.
- Logo de 3R (20 oct 2026, pedido de Rigoberto: no le gustaba el «3R» de trazo): ahora es **la cara del león** + «3R» en Bebas Neue (`@fontsource/bebas-neue`, la escogió Rigoberto el 20 oct 2026 entre seis) (`components/logo.tsx`, `public/logo-leon.jpg`); en la pestaña y el celular, `app/favicon.ico` (RGBA, Next no acepta otro), `app/icon.jpg` y `app/apple-icon.jpg`. La imagen para compartir por WhatsApp y redes (`opengraph-image.tsx`, 20 oct 2026) también lleva el león y «3R» en Bebas Neue; sus archivos (león y letras en .woff, porque esa imagen no lee .woff2) están en `apps/web/assets/`.
- Precios de los paquetes (20 oct 2026, pedido de Rigoberto): **Página Esencial $550.000, Sitio para tu Negocio $950.000, Presencia Completa $1.800.000**; el menú con QR se queda en $350.000. Migración `20261020120000_package_prices` (cambia `packages.price_cents` por slug al publicar `main`; los pedidos guardan su propio precio). También en el seed, la presentación de ventas y la respuesta «PRECIOS» de Chatplace. Entró a `main` con el PR #41 (20 oct 2026). **No borrar la rama `claude/wonderful-turing-7baisf`**: las publicaciones programadas de Instagram bajan los videos de ahí.
- Dominio propio del cliente: $50.000 al año (`DOMAIN_ADDON_CENTS`); el pedido cobra el primer año. La renovación
  se cobra aparte (a mano): 30 días antes de vencer, un cron diario de Vercel avisa al cliente (correo + mensaje en
  su pedido) y al equipo; en `/admin` se marca "Renovado un año". Necesita `CRON_SECRET` en Render y en Vercel. El equipo lo asigna en el pedido en
  `/admin` y lo agrega a mano en Vercel (ver README, "Dominio propio de un cliente").
- Wompi: en producción (27 sep 2026). Rigoberto puso las llaves de producción en Render y la URL de eventos en Wompi;
  el pago de prueba en sandbox había funcionado. Datos de transferencia (`PAYMENT_INSTRUCTIONS`) puestos en Vercel.
  Rigoberto dice que también configuró `CRON_SECRET`; no se ha podido comprobar desde la sesión (sin acceso de red a
  3rpaginas.com ni a Render).
- Pendiente de Rigoberto: revisar que el portafolio en vivo tenga capturas. Siguiente contenido: enero 2027 para Instagram.
- Portada (16 oct 2026): **sin «Iniciar sesión» por pedido de Rigoberto**: todo se pide por WhatsApp (los paquetes, los
  servicios y el llamado final abren WhatsApp con el mensaje armado). /login y /registro siguen existiendo (el equipo entra
  a /admin por /login) pero no se enlazan ni van en el sitemap. Sección «Más de lo que hacemos» (`#servicios`): menú QR
  $350.000, tarjeta de sellos con QR $69.000/mes + $150.000, Restaurant Control desde $119.000/mes (enlaza a
  /software#restaurantes, nunca a la app), tienda $1.200.000 + $90.000/mes, contenido redes $590.000/$990.000 al mes,
  flyers desde $40.000 y dominio. Desde la segunda vuelta (16 oct 2026) también: chatbot de WhatsApp con IA $149.000/mes +
  $250.000 (el del módulo WhatsApp), menú completo en 4 idiomas con carrito y reservas $650.000, página con video que se
  mueve $990.000, manual de marca $450.000 y perfil de Google y reseñas $150.000. Precios fijados mirando el mercado
  colombiano (los últimos cinco casi sin precios publicados en pesos: por criterio); todos en `apps/web/lib/services.ts`. La
  plataforma para empresas se vende en /software con sus precios por módulo (no repetir planes en la portada).
  **3R Burgers es una página de muestra a la venta, sin dueño** (dicho por Rigoberto el 16 oct 2026): sale en «Páginas
  listas para estrenar» (`#lista`, `READY_MADE` en `lib/services.ts`, $790.000 con la marca del comprador) y no en
  «Trabajos» aunque esté en el portafolio. Tarjeta de sellos: el servidor (`apps/api/src/loyalty`, `/admin/fidelizacion`)
  venía de la rama `claude/wonderful-ptolemy-wr2mkk` y entró a main el 16 oct 2026; lo usa `azulcaribemenudigital` (`/sellos`).
  Render ya publica desde `main` (comprobado por Rigoberto el 16 oct 2026) y tiene `LOYALTY_ORIGINS=https://azulcaribelounge.com`;
  la tarjeta de sellos de Azul Caribe funciona en vivo (probada por Rigoberto el 16 oct 2026). Una publicación falló por
  juntarse con otra (timeout del health check); con «Deploy latest commit» sola quedó Live.
- Portada: aviso del control de asistencia (sección `#asistencia`, antes de las preguntas): $90.000/mes, instalación
  $300.000 o $150.000 si también compra su página. El botón va a WhatsApp, nunca a la app de asistencia (precios en
  `ATTENDANCE_*` de `apps/web/app/page.tsx`).
- Cuenta del cliente (`/dashboard`, 30 sep 2026): sin pedidos ve una introducción (qué es 3R, "un día normal de tu
  negocio" con y sin página, por qué dar el paso), luego los paquetes (`components/package-grid.tsx`, el mismo de la
  portada) y "Más servicios" (asistencia QR, asistencia mensual, dominio; botones a WhatsApp). Con pedidos: sus pedidos
  y "Más servicios". Precios de la asistencia QR en `apps/web/lib/services.ts`.
- **Plataforma empresarial** (3 oct 2026): Rigoberto quiere que 3rpaginas.com sea una plataforma para empresas (web,
  empleados, clientes, automatización, IA), no solo venta de páginas, y construir los 25 módulos uno por uno. **No mezclar
  con `asistencia/` ni con otros proyectos salvo que él lo pida.** Hecho: núcleo de empresas, miembros con roles,
  invitaciones y módulos por empresa (`/empresa`, `/admin/empresas`; ver README, "Plataforma empresarial"). Módulos
  listos: CRM (`/empresa/[id]/crm`), Tickets (`/empresa/[id]/tickets`) Portal del empleado (`/empresa/[id]/personal`),
  Permisos y vacaciones (`/empresa/[id]/solicitudes`) Comunicados (`/empresa/[id]/comunicados`) y
  Documentos (`/empresa/[id]/documentos`, archivos privados; recomendado crear un bucket R2 privado `R2_DOCS_BUCKET`) ,
  Generador de documentos (`/empresa/[id]/generador`, PDF con `pdf-lib`), Calendario (`/empresa/[id]/calendario`) y
  Alertas (campanita + resumen diario por correo; usa el cron diario de dominios y `CRON_SECRET`). Cotizaciones (`/empresa/[id]/cotizaciones`; el cliente responde en `/cotizacion/[token]`). Encuestas (`/empresa/[id]/encuestas`, del equipo o de clientes con enlace `/encuesta/[token]`). Capacitaciones (`/empresa/[id]/capacitaciones`, lecciones, evaluación y certificado PDF). Centro de conocimiento (`/empresa/[id]/conocimiento`; ayuda pública para clientes en `/ayuda/[token]`). Inventario y equipos entregados (`/empresa/[id]/inventario`). Tienda online (`/empresa/[id]/tienda`; la tienda pública en `/tienda/[slug]`, pedidos también por WhatsApp; sin pago en línea todavía). Página web (`/empresa/[id]/pagina-web`: la empresa cambia textos, fotos y botones de su página y la publica; el diseño solo lo cambia 3R; 3R la vincula en `/admin/empresas/[id]`). Analítica web (`/empresa/[id]/analitica`: visitas sin cookies; la web firma cada visita con `CRON_SECRET`, así que debe estar igual en Render y en Vercel). SEO (`/empresa/[id]/seo`: nota de 0 a 100, qué arreglar y título y descripción para Google). Automatizaciones (`/empresa/[id]/automatizaciones`: si pasa X —pedido, formulario, cotización, ticket, poco inventario— avisar, mandar correo, guardar en el CRM o crear un ticket). Marketing (`/empresa/[id]/marketing`: campañas de correo por grupos del CRM, solo a quien aceptó; baja en `/baja/[token]`, suscripción pública en `/suscribirse/[token]`; tope 300 al día por empresa). Asistente con IA (`/empresa/[id]/asistente`: responde con artículos y documentos marcados; **funciona en vivo** desde el 16 oct 2026: `ANTHROPIC_API_KEY` en Render (la misma llave de su software para empresas), probado por Rigoberto; falta probar en vivo el chatbot de WhatsApp, que además necesita las variables de Meta). Textos con IA (`/empresa/[id]/textos`: 3 opciones de publicaciones, descripciones, correos, textos de página, Google y WhatsApp; botón «Escribir con IA» en Marketing y en productos; misma llave). WhatsApp empresarial (`/empresa/[id]/whatsapp`: bandeja con la API de Meta, respuestas en 24 h, plantillas, CRM; **chatbot con IA** (16 oct 2026): la empresa escribe la información del negocio y lo prende; responde solo y pasa a una persona cuando hace falta; 3R conecta el número en `/admin/empresas/[id]`; **faltan `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` y `DATA_ENCRYPTION_KEY` en Render y la cuenta de Meta de cada negocio**). Los 25 módulos están construidos. Tablero en `/empresa/[id]`.
  Suscripciones: precios por módulo en `/admin/modulos` (aprobados el 6 oct 2026: básico $15.000, intermedio $29.000,
  premium $49.000; los carga la migración `20261006010000_module_prices` sin pisar los que ya estén puestos), plan y facturas por
  empresa, pago con Wompi o transferencia en `/empresa/[id]/facturacion`. Orden acordado en PENDIENTES.md: dashboard, CRM, tickets, portal del empleado,
  permisos y vacaciones, comunicados, documentos, generador de documentos, calendario, alertas, cotizaciones,
  suscripciones, encuestas, capacitaciones, conocimiento, inventario, tienda, constructor web, analítica, SEO,
  automatizaciones, marketing, IA (asistente y textos), WhatsApp (API de Meta).
- Página de venta del software para empresas en `/software` (5 oct 2026), enlazada desde el menú y una sección de la portada.
  Muestra «Desde $15.000 por módulo al mes» y los precios de Restaurant Control (sección `#restaurantes`, sin enlace a la app:
  Esencial $119.000 y Completo $189.000 al mes por sede; instalación $350.000 o $200.000 con página; sede adicional a la
  mitad; anual con 2 meses gratis). Precio de lanzamiento solo por WhatsApp, no publicado: Completo a $99.000/mes por 12
  meses para los 3 primeros restaurantes. Los botones van a WhatsApp.
- **Dropshipping propio de Rigoberto** (21 oct 2026): la página «Negro Nuevo» se borró del repositorio el 24 oct 2026 a pedido de Rigoberto (dejó el proyecto); está en el historial de git si la quiere de vuelta.
- 3R Burgers: página de muestra a la venta, sin dueño (16 oct 2026). Rigoberto pidió ayuda para conseguir comprador.

## Este proyecto

- Monorepo: `apps/web` (Next.js 16 + Tailwind 4) y `apps/api` (NestJS 12 + Prisma 7 + PostgreSQL).
  Detalles, variables y despliegue en `README.md` de la raíz.
- Diseño: sigue `design/REFERENCIA-LOVABLE.md` (modo oscuro, Sora + Manrope, tokens de color). Aquí los botones
  en píldora y los eyebrows en mayúsculas **sí** son parte del sistema; la lista de prohibidos de las reglas
  generales aplica solo a lo que esa referencia no define.
- La API es ESM: los imports relativos llevan extensión `.js`. TypeScript 6 (el CLI de Nest aún no funciona con 7).
- Pruebas: `npm test -w web`, y `npm test -w api` (requiere `npm run dev:db -w api` y `npm run build -w api`).
