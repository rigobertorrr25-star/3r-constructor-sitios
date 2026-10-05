# 3R — Tienda de páginas web

Reglas generales de trabajo (iguales en todos los proyectos de Rigoberto):
@docs/claude/instrucciones-globales.md

## Estado (actualízalo cuando algo cambie: otras sesiones no recuerdan lo que se habló)

- **Publicada en producción** en https://3rpaginas.com: base en Neon, API en Render, web en Vercel, archivos en
  Cloudflare R2 y correos con Resend. `main` es lo que está en vivo. API en Render: https://threer-api-79ux.onrender.com
  (plan gratis: se duerme sin uso; no lanzar dos deploys a la vez o `prisma migrate deploy` falla por el bloqueo).
- Política de privacidad en `/privacidad` (Ley 1581), completa. Datos del responsable en `RESPONSABLE` de
  `apps/web/app/privacidad/page.tsx`.
- Portada (26 sep 2026): botón "Ver paquetes" fijo arriba, sección "Lo que pasa hoy" (problema del cliente), león
  recortado en cuadrado y fundido con el fondo, globo de la mascota que se cierra al hacer scroll.
- Instagram: se entregó foto de perfil, carrusel de presentación y el contenido de octubre 2026 (calendario en
  https://claude.ai/artifact/6A1HRPqkdhT4PwXqbvon6Q). Rigoberto programó hasta el 15 oct. Segundo paquete (16 oct –
  15 nov: piezas 8–14 de octubre + 6 nuevas de noviembre + 15 historias con sticker por día) en
  https://claude.ai/artifact/LS8mhicvdzLWUUdHDGAMvp. El post del 14 nov (pago en línea) ya puede salir (Wompi en
  producción). Tercer paquete (16 nov – 31 dic: 20 publicaciones con 4 reels de asistencia QR, cuenta
  del cliente y Azul Caribe en 3 pantallas, 17 historias) en https://claude.ai/artifact/Kef33AtRmyGxDg6XH14CUy.
  Siguiente: enero 2027. No hay conexión para publicar directo: Rigoberto programa en Meta
  Business Suite.
- Instagram de 3R: https://www.instagram.com/3r.paginas_/ (en el pie de la portada y en los datos para Google).
- Precios de los paquetes: ya confirmados por Rigoberto en `/admin/paquetes`.
- Dominio propio del cliente: $50.000 al año (`DOMAIN_ADDON_CENTS`); el pedido cobra el primer año. La renovación
  se cobra aparte (a mano): 30 días antes de vencer, un cron diario de Vercel avisa al cliente (correo + mensaje en
  su pedido) y al equipo; en `/admin` se marca "Renovado un año". Necesita `CRON_SECRET` en Render y en Vercel. El equipo lo asigna en el pedido en
  `/admin` y lo agrega a mano en Vercel (ver README, "Dominio propio de un cliente").
- Wompi: en producción (27 sep 2026). Rigoberto puso las llaves de producción en Render y la URL de eventos en Wompi;
  el pago de prueba en sandbox había funcionado. Datos de transferencia (`PAYMENT_INSTRUCTIONS`) puestos en Vercel.
  Rigoberto dice que también configuró `CRON_SECRET`; no se ha podido comprobar desde la sesión (sin acceso de red a
  3rpaginas.com ni a Render).
- Pendiente de Rigoberto: revisar que el portafolio en vivo tenga capturas. Siguiente contenido: enero 2027 para Instagram.
- Asistencia con QR (28 sep 2026): sistema **aparte** de la tienda en `asistencia/` (ver su README). Rigoberto pidió
  que no aparezca nada en 3rpaginas.com: no enlazarlo desde la tienda ni compartir base, clave o despliegue. Usa el estilo
  3R y el león. Primer negocio: Azul Caribe Lounge (11 empleados; turnos 8am–3pm, 11am–6pm, 2pm–9pm). Publicado en
  https://3r-constructor-sitios.vercel.app (proyecto propio de Vercel, Root Directory `asistencia`; base en el proyecto
  ASISTENCIA de Neon). El turno no se asigna por empleado: se deduce de la hora de llegada (turnos del negocio en
  el panel). Cada empleado crea su propio PIN la primera vez que escanea. En español e inglés (botón ES | EN; los jefes de
  Rigoberto son de EE. UU.): todo texto nuevo va en los dos idiomas en `asistencia/lib/i18n.ts`. Los jefes de
  cada negocio tienen acceso de solo lectura (sección "Jefes" del panel; entran con su clave en `/entrar`). Empleados cargados y tablet con QR listos (29 sep 2026).
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
  Alertas (campanita + resumen diario por correo; usa el cron diario de dominios y `CRON_SECRET`). Cotizaciones (`/empresa/[id]/cotizaciones`; el cliente responde en `/cotizacion/[token]`). Encuestas (`/empresa/[id]/encuestas`, del equipo o de clientes con enlace `/encuesta/[token]`). Capacitaciones (`/empresa/[id]/capacitaciones`, lecciones, evaluación y certificado PDF). Centro de conocimiento (`/empresa/[id]/conocimiento`; ayuda pública para clientes en `/ayuda/[token]`). Inventario y equipos entregados (`/empresa/[id]/inventario`). Tienda online (`/empresa/[id]/tienda`; la tienda pública en `/tienda/[slug]`, pedidos también por WhatsApp; sin pago en línea todavía). Página web (`/empresa/[id]/pagina-web`: la empresa cambia textos, fotos y botones de su página y la publica; el diseño solo lo cambia 3R; 3R la vincula en `/admin/empresas/[id]`). Analítica web (`/empresa/[id]/analitica`: visitas sin cookies; la web firma cada visita con `CRON_SECRET`, así que debe estar igual en Render y en Vercel). SEO (`/empresa/[id]/seo`: nota de 0 a 100, qué arreglar y título y descripción para Google). Automatizaciones (`/empresa/[id]/automatizaciones`: si pasa X —pedido, formulario, cotización, ticket, poco inventario— avisar, mandar correo, guardar en el CRM o crear un ticket). Marketing (`/empresa/[id]/marketing`: campañas de correo por grupos del CRM, solo a quien aceptó; baja en `/baja/[token]`, suscripción pública en `/suscribirse/[token]`; tope 300 al día por empresa). Asistente con IA (`/empresa/[id]/asistente`: responde con artículos y documentos marcados; necesita `ANTHROPIC_API_KEY` en Render: Rigoberto dice que ya la puso (3 oct 2026); no se ha podido comprobar desde la sesión). Textos con IA (`/empresa/[id]/textos`: 3 opciones de publicaciones, descripciones, correos, textos de página, Google y WhatsApp; botón «Escribir con IA» en Marketing y en productos; misma llave). WhatsApp empresarial (`/empresa/[id]/whatsapp`: bandeja con la API de Meta, respuestas en 24 h, plantillas, CRM; 3R conecta el número en `/admin/empresas/[id]`; **faltan `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` y `DATA_ENCRYPTION_KEY` en Render y la cuenta de Meta de cada negocio**). Los 25 módulos están construidos. Tablero en `/empresa/[id]`.
  Suscripciones: precios por módulo en `/admin/modulos` (**faltan los precios reales de Rigoberto**), plan y facturas por
  empresa, pago con Wompi o transferencia en `/empresa/[id]/facturacion`. Orden acordado en PENDIENTES.md: dashboard, CRM, tickets, portal del empleado,
  permisos y vacaciones, comunicados, documentos, generador de documentos, calendario, alertas, cotizaciones,
  suscripciones, encuestas, capacitaciones, conocimiento, inventario, tienda, constructor web, analítica, SEO,
  automatizaciones, marketing, IA (asistente y textos), WhatsApp (API de Meta). Precios por módulo: pendientes de Rigoberto.
- Página de venta del software para empresas en `/software` (5 oct 2026), enlazada desde el menú y una sección de la portada.
  Sin precios hasta que Rigoberto los defina; los botones van a WhatsApp.
- **Restaurant Control** (5 oct 2026): sistema **aparte** en `restaurante/` (como `asistencia/`: su propia base, clave y
  despliegue; no enlazar desde 3rpaginas.com ni compartir base). Producto general para cualquier restaurante o bar (no
  solo Azul Caribe), y también barberías/peluquerías (módulo 13). Nace de los bocetos de 13 módulos de Rigoberto (ZIP): se
  tomaron las reglas y se reescribió con la tecnología de la asistencia, varios negocios desde el día uno, plata en pesos
  enteros, nada se borra (auditoría y movimientos de inventario protegidos en la base). **Los 13 módulos están
  construidos** (detalle en `restaurante/README.md`); 49 pruebas contra PostgreSQL real. **Publicado (5 oct 2026)** en
  https://3r-constructor-sitios-git1.vercel.app (proyecto propio de Vercel, Root Directory `restaurante`; base en el proyecto
  `restaurante` de Neon, id `misty-haze-65464257`). Variables en Vercel: `DATABASE_URL`, `ADMIN_PASSWORD`,
  `SESSION_SECRET` y opcional `ANTHROPIC_API_KEY` (no se ha podido comprobar si la puso). Usar siempre la dirección fija,
  no la de cada publicación. Pendiente de él: elegir proveedor de factura
  electrónica (Alegra, Siigo…) para el envío a la DIAN (módulo 10: todo lo demás listo) y probar el resumen con IA con la
  llave real. El esquema de la base se aplica solo cuando cambia (tabla `schema_meta`). Ingreso (5 oct 2026): en la portada se
  escoge el restaurante de una lista (los activos) y se toca el nombre de la persona y se pone su PIN (el código de empleado queda interno; no puede haber dos nombres
  activos iguales); `/n/{negocio}` sigue sirviendo. Cada restaurante puede tener su foto de fondo (Sedes → Fondo del restaurante;
  se ve en el ingreso y detrás de la app).
- 3R Burgers: no está confirmado si es cliente real o página de muestra; no presentarlo como cliente sin preguntar.

## Este proyecto

- `asistencia/`: app independiente (control de asistencia con QR), con su propio `package.json`; no es workspace.
- `restaurante/`: app independiente (Restaurant Control), con su propio `package.json`; no es workspace.
  Pruebas: `npm test` dentro de `restaurante/` con `TEST_DATABASE_URL`.
- Monorepo: `apps/web` (Next.js 16 + Tailwind 4) y `apps/api` (NestJS 12 + Prisma 7 + PostgreSQL).
  Detalles, variables y despliegue en `README.md`.
- Diseño: sigue `design/REFERENCIA-LOVABLE.md` (modo oscuro, Sora + Manrope, tokens de color). Aquí los botones
  en píldora y los eyebrows en mayúsculas **sí** son parte del sistema; la lista de prohibidos de las reglas
  generales aplica solo a lo que esa referencia no define.
- La API es ESM: los imports relativos llevan extensión `.js`. TypeScript 6 (el CLI de Nest aún no funciona con 7).
- Pruebas: `npm test -w web`, y `npm test -w api` (requiere `npm run dev:db -w api` y `npm run build -w api`).
- Textos visibles para el usuario, en español de Colombia; precios en COP.
