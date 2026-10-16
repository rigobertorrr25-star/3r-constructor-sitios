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
  **Plan de ventas 17 oct – 15 nov 2026** (reemplaza el segundo paquete en esas fechas; hecho con datos de Chatplace):
  https://claude.ai/artifact/KF4eeSwkMd63iUBhe4j1su (13 publicaciones mar/jue/sáb 7 p. m., historias diarias, comparación con
  la competencia, bio nueva). Chatplace está conectado al Instagram (bot «3Rpaginas»); su saldo de IA está en 0, así que no
  analiza competencia ni genera contenido. Ahí quedaron 3 automatizaciones de comentario/mensaje **en pausa** (PRECIOS, BURGER,
  CHATBOT/SELLOS → mensaje privado con precios y enlace, una vez al día por persona); Rigoberto las prende. Datos de la cuenta
  (16 oct): 3.961 seguidores, mediana 57 vistas por reel, mejor reel 3R Burgers (495). Siguiente: enero 2027. Rigoberto
  programa en Meta Business Suite.
  **Contenido grabado de verdad** (16 oct 2026, pedido de Rigoberto: «que no se vea IA»): `marketing/instagram/2026-10/`
  (4 reels 1080x1920 grabados de las páginas reales —Azul Caribe en 4 idiomas, 3R Burgers, tarjeta de sellos, pedido en
  Fidelio— y un carrusel de capturas reales; `publicaciones.json` con fecha, hora y texto, sin numerales ni signo de
  porcentaje). Se hicieron con Playwright (screencast del celular) + ffmpeg, textos estilo Instagram. Instagram está
  conectado por Composio (IG user 17841455473211605): se probó crear un contenedor sin publicar y quedó FINISHED (subir
  el archivo con upload_local_file y pasar video_file/s3key; la URL raw de GitHub llega como octet-stream). Publicar solo a
  una hora quedó bloqueado por el sistema de seguridad (rutinas sin conectores; recordatorios negados): Rigoberto programa
  en Meta Business Suite o pide publicar en el momento. El reel del chatbot no se grabó: aquí no hay IA real ni WhatsApp
  conectado y no se finge. La primera edición (cajitas de texto, lenta, sin música) **no le gustó a Rigoberto**; la segunda
  (misma carpeta) es estilo TikTok: cortes al ritmo de 124 BPM, celular inclinado sobre fondo desenfocado, zooms, textos Sora
  800 en mayúsculas con borde y rebote, música original por código. Herramientas en el scratchpad de la sesión (tk/editor.html,
  render.mjs, beat.py); si se pierden, rehacerlas así.
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
- **Restaurant Control** (5 oct 2026): sistema **aparte** en `restaurante/` (como `asistencia/`: su propia base, clave y
  despliegue; no enlazar desde 3rpaginas.com ni compartir base). Producto general para cualquier restaurante o bar (no
  solo Azul Caribe), y también barberías/peluquerías (módulo 13). Nace de los bocetos de 13 módulos de Rigoberto (ZIP): se
  tomaron las reglas y se reescribió con la tecnología de la asistencia, varios negocios desde el día uno, plata en pesos
  enteros, nada se borra (auditoría y movimientos de inventario protegidos en la base). **Los 13 módulos están
  construidos** (detalle en `restaurante/README.md`); 75 pruebas contra PostgreSQL real. **Publicado (5 oct 2026)** en
  https://3r-constructor-sitios-git1.vercel.app (proyecto propio de Vercel, Root Directory `restaurante`; base en el proyecto
  `restaurante` de Neon, id `misty-haze-65464257`). Variables en Vercel: `DATABASE_URL`, `ADMIN_PASSWORD`,
  `SESSION_SECRET` y `ANTHROPIC_API_KEY` (puesta el 5 oct 2026, llave propia `restaurant-control`; el Tablero ya dice «Escrito con IA»; el resumen usa `claude-sonnet-5-5` desde el 6 oct 2026 para gastar la mitad). Usar siempre la dirección fija,
  no la de cada publicación. Ícono de la pestaña y del celular: el león de 3R (`app/favicon.ico`, `app/icon.jpg`, `app/apple-icon.jpg` y `public/apple-touch-icon.png`, 15 oct 2026; el `.ico` hace falta porque muchos navegadores solo buscan ese). Pendiente de él: elegir proveedor de factura
  electrónica (Alegra, Siigo…) para el envío a la DIAN (módulo 10: todo lo demás listo). El esquema de la base se aplica solo cuando cambia (tabla `schema_meta`). Ingreso (5 oct 2026): en la portada se
  escoge el restaurante de una lista (los activos) y se toca el nombre de la persona y se pone su PIN (el código de empleado queda interno; no puede haber dos nombres
  activos iguales); `/n/{negocio}` sigue sirviendo. Cada restaurante puede tener su foto de fondo (Sedes → Fondo del restaurante;
  se ve en el ingreso y detrás de la app; en el ingreso la tarjeta es transparente para que se vea la foto, pedido de Rigoberto 12 oct 2026; la foto va sola de piso en el mapa de Mesas y en Plano de cada restaurante (pedido de Rigoberto 15 oct 2026; columna `on_floor`, por defecto sí); en Sedes el dueño puede «Volver al piso de madera»). Fotos de cada producto (Carta → Editar, 6 oct 2026): salen en la carta QR y en
  la pantalla de pedido del mesero. **Español e inglés** (6 oct 2026, botón ES | EN en todas las pantallas; detalle en
  `restaurante/README.md`): Rigoberto primero dijo que no y después pidió de nuevo el sistema en inglés (6 oct 2026);
  todo texto nuevo va con `t()` y su inglés en `restaurante/lib/i18n/en/`; lo impreso sigue en español. **Impresión de comandas** (6 oct 2026, pedido de Rigoberto: los restaurantes
  trabajan con comandas impresas, no con pantallas): impresoras térmicas de red por sede en `/app/impresoras`; comandas por
  estación, anulaciones, precuenta y cierre de caja salen impresos; un programa de 3R en un PC del local
  (`restaurante/public/impresion/agente-3r.mjs` + `iniciar-windows.bat`, necesita Node.js) los pide con el código de la sede
  y los manda por la red (puerto 9100). Detalle en `restaurante/README.md`.
  **Plano** (12 oct 2026, con fotos de referencia de Rigoberto): visto desde arriba, piso cálido, mesas de madera con sillas
  tapizadas y aro de color por estado (en las redondas, la mitad de las sillas a cada lado, juntas: no en cruz); el dueño pone las barras en Plano → «Agregar barra» (tabla `floor_fixtures`, solo dibujo). Pisos o zonas (14 oct 2026): en Plano, «+ Agregar piso o zona» (p. ej. «Segundo piso») crea la pestaña y las mesas que se agreguen ahí quedan en ese piso; en Mesas cada piso es una pestaña. «Agregar varias mesas» (12 oct 2026) crea hasta 60 mesas
  numeradas seguidas y acomodadas en filas; al tocar una mesa sale abajo un cuadro pequeño con «Quitar» y «Editar número, puestos y forma» plegado, para no tapar el plano (14 oct 2026). «Seleccionar varias» marca mesas con un toque y las quita juntas; «Quitar todas las mesas» (con casilla de confirmación) deja el plano vacío; las abiertas nunca se quitan. **Importar carta** (Carta → «Importar carta», 12 oct 2026): se pega
  la carta en texto (categoría en su línea, cada producto con su precio al final) y se cargan categorías y productos; no repite
  y actualiza precios. **Biblioteca de fotos de 3R** (12 oct 2026): 76 fotos de bebidas creadas con IA
  (Higgsfield, calidad media, ~38 créditos de Rigoberto) en `restaurante/public/biblioteca`; Carta → «Poner fotos de la biblioteca» se las
  pone a los productos sin foto según el nombre (`lib/photo-library.ts`). Para una bebida nueva: agregar la foto y su nombre a `LIBRARY`. **Inventario masivo** (Inventario, 12 oct 2026, `lib/inventory-bulk.ts`): «Crear inventario desde la carta» crea un insumo por producto (mismo nombre, en unidades, receta de 1 por venta) de las categorías marcadas; «Cargar existencias de una vez» es una tabla con todos los insumos para escribir cuántos hay (queda como conteo), el costo de una y el mínimo. El bartender también los usa (permiso `inventory.load`), sin ver ni cambiar costos; el dueño y el administrador ven cada movimiento con quién y cuándo en `/app/inventario/movimientos` (filtros por persona, tipo y día). En la pantalla de pedido el mesero ve «Quedan N» de cada producto con inventario cargado (`sellableStock`, se refresca cada 15 s); en 0 sale «Agotado» y no deja pedir más de lo que queda.
- **DELIRIUM** (11 oct 2026): bar que solo vende licores, sin cajera. Meseros Caridad, Paola, Johan e Isabel; bartender
  Breiner; administrador Agusto. Para ellos se hizo la «forma de trabajo» de Restaurant Control (Sedes): cada mesero cobra
  sus mesas y entrega su cierre, el administrador lo verifica en «Meseros»; y «solo bar». No usa impresoras (12 oct 2026): el bartender ve los pedidos en la pantalla «Barra». Cobro (12 oct 2026): el mesero toca «Cobrar cuenta» (en el mapa o en el pedido), elige efectivo, datáfono o transferencia y cierra; «Precuenta» muestra la cuenta en el teléfono; no hay «Pedir la cuenta». Propina: Sedes → Forma de trabajo → «Propina sugerida (%)»; en 0 no se ofrece al cobrar ni sale en la precuenta (Rigoberto pidió quitarla en DELIRIUM: la pone en 0 él en vivo). Una mesa que abrió el dueño o el administrador la cobra el mesero y entra a su cierre. Rigoberto ya armó su plano en vivo. Hay que crearlo en el sistema en
  vivo desde `/admin` (lo hace Rigoberto, que es el dueño; el administrador se llama Agusto, así, sin «u»).
- 3R Burgers: página de muestra a la venta, sin dueño (16 oct 2026). Rigoberto pidió ayuda para conseguir comprador.

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
