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
  https://claude.ai/artifact/LS8mhicvdzLWUUdHDGAMvp. El post del 14 nov (pago en línea) solo sale con Wompi en
  producción. Siguiente: 16 nov – diciembre. No hay conexión para publicar directo: Rigoberto programa en Meta
  Business Suite.
- Instagram de 3R: https://www.instagram.com/3r.paginas_/ (en el pie de la portada y en los datos para Google).
- Precios de los paquetes: ya confirmados por Rigoberto en `/admin/paquetes`.
- Dominio propio del cliente: $50.000 al año (`DOMAIN_ADDON_CENTS`); el pedido cobra el primer año. La renovación
  se cobra aparte (a mano): 30 días antes de vencer, un cron diario de Vercel avisa al cliente (correo + mensaje en
  su pedido) y al equipo; en `/admin` se marca "Renovado un año". Necesita `CRON_SECRET` en Render y en Vercel. El equipo lo asigna en el pedido en
  `/admin` y lo agrega a mano en Vercel (ver README, "Dominio propio de un cliente").
- Wompi: publicado (27 sep 2026). Pago de prueba (sandbox) hecho y funcionando. Falta cambiar en Render a las llaves
  de producción (pub_prod_…, prod_integrity_…, prod_events_…) y poner la URL de eventos en el ambiente de producción.
- Pendiente de Rigoberto: datos de pago por transferencia (`PAYMENT_INSTRUCTIONS` en la web) y revisar que el
  portafolio en vivo tenga capturas. Siguiente contenido: 16 nov – diciembre para Instagram.
- Asistencia con QR (28 sep 2026): sistema **aparte** de la tienda en `asistencia/` (ver su README). Rigoberto pidió
  que no aparezca nada en 3rpaginas.com: no enlazarlo desde la tienda ni compartir base, clave o despliegue. Usa el estilo
  3R y el león. Primer negocio: Azul Caribe Lounge (11 empleados; turnos 8am–3pm, 11am–6pm, 2pm–9pm). Publicado en
  https://3r-constructor-sitios.vercel.app (proyecto propio de Vercel, Root Directory `asistencia`; base en el proyecto
  ASISTENCIA de Neon). Falta: crear el negocio y los empleados en el panel y dejar la tablet en la entrada.
- 3R Burgers: no está confirmado si es cliente real o página de muestra; no presentarlo como cliente sin preguntar.

## Este proyecto

- `asistencia/`: app independiente (control de asistencia con QR), con su propio `package.json`; no es workspace.
- Monorepo: `apps/web` (Next.js 16 + Tailwind 4) y `apps/api` (NestJS 12 + Prisma 7 + PostgreSQL).
  Detalles, variables y despliegue en `README.md`.
- Diseño: sigue `design/REFERENCIA-LOVABLE.md` (modo oscuro, Sora + Manrope, tokens de color). Aquí los botones
  en píldora y los eyebrows en mayúsculas **sí** son parte del sistema; la lista de prohibidos de las reglas
  generales aplica solo a lo que esa referencia no define.
- La API es ESM: los imports relativos llevan extensión `.js`. TypeScript 6 (el CLI de Nest aún no funciona con 7).
- Pruebas: `npm test -w web`, y `npm test -w api` (requiere `npm run dev:db -w api` y `npm run build -w api`).
- Textos visibles para el usuario, en español de Colombia; precios en COP.
