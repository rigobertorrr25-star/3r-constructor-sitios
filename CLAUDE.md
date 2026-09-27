# 3R — Tienda de páginas web

Reglas generales de trabajo (iguales en todos los proyectos de Rigoberto):
@docs/claude/instrucciones-globales.md

## Estado (actualízalo cuando algo cambie: otras sesiones no recuerdan lo que se habló)

- **Publicada en producción** en https://3rpaginas.com: base en Neon, API en Render, web en Vercel, archivos en
  Cloudflare R2 y correos con Resend. `main` es lo que está en vivo.
- Política de privacidad en `/privacidad` (Ley 1581), completa. Datos del responsable en `RESPONSABLE` de
  `apps/web/app/privacidad/page.tsx`.
- Portada (26 sep 2026): botón "Ver paquetes" fijo arriba, sección "Lo que pasa hoy" (problema del cliente), león
  recortado en cuadrado y fundido con el fondo, globo de la mascota que se cierra al hacer scroll.
- Instagram: se entregó foto de perfil, carrusel de presentación y el contenido de octubre 2026 (14 publicaciones,
  calendario en https://claude.ai/artifact/6A1HRPqkdhT4PwXqbvon6Q). No hay conexión para publicar directo: Rigoberto
  programa en Meta Business Suite.
- Instagram de 3R: https://www.instagram.com/3r.paginas_/ (en el pie de la portada y en los datos para Google).
- Precios de los paquetes: ya confirmados por Rigoberto en `/admin/paquetes`.
- Dominio propio del cliente: +$50.000 (pago único, `DOMAIN_ADDON_CENTS`). El equipo lo asigna en el pedido en
  `/admin` y lo agrega a mano en Vercel (ver README, "Dominio propio de un cliente").
- Wompi: publicado (27 sep 2026). Llaves de PRUEBA (sandbox) puestas en Render y URL de eventos configurada en
  Wompi. Falta: pago de prueba y luego cambiar a llaves de producción (pub_prod_…).
- Pendiente de Rigoberto: datos de pago por transferencia (`PAYMENT_INSTRUCTIONS` en la web) y revisar que el
  portafolio en vivo tenga capturas. Siguiente contenido: noviembre/diciembre para Instagram.
- 3R Burgers: no está confirmado si es cliente real o página de muestra; no presentarlo como cliente sin preguntar.

## Este proyecto

- Monorepo: `apps/web` (Next.js 16 + Tailwind 4) y `apps/api` (NestJS 12 + Prisma 7 + PostgreSQL).
  Detalles, variables y despliegue en `README.md`.
- Diseño: sigue `design/REFERENCIA-LOVABLE.md` (modo oscuro, Sora + Manrope, tokens de color). Aquí los botones
  en píldora y los eyebrows en mayúsculas **sí** son parte del sistema; la lista de prohibidos de las reglas
  generales aplica solo a lo que esa referencia no define.
- La API es ESM: los imports relativos llevan extensión `.js`. TypeScript 6 (el CLI de Nest aún no funciona con 7).
- Pruebas: `npm test -w web`, y `npm test -w api` (requiere `npm run dev:db -w api` y `npm run build -w api`).
- Textos visibles para el usuario, en español de Colombia; precios en COP.
