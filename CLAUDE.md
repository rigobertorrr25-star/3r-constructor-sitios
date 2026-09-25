# 3R — Tienda de páginas web

Reglas generales de trabajo (iguales en todos los proyectos de Rigoberto):
@docs/claude/instrucciones-globales.md

## Este proyecto

- Monorepo: `apps/web` (Next.js 16 + Tailwind 4) y `apps/api` (NestJS 12 + Prisma 7 + PostgreSQL).
  Detalles, variables y despliegue en `README.md`.
- Diseño: sigue `design/REFERENCIA-LOVABLE.md` (modo oscuro, Sora + Manrope, tokens de color). Aquí los botones
  en píldora y los eyebrows en mayúsculas **sí** son parte del sistema; la lista de prohibidos de las reglas
  generales aplica solo a lo que esa referencia no define.
- La API es ESM: los imports relativos llevan extensión `.js`. TypeScript 6 (el CLI de Nest aún no funciona con 7).
- Pruebas: `npm test -w web`, y `npm test -w api` (requiere `npm run dev:db -w api` y `npm run build -w api`).
- Textos visibles para el usuario, en español de Colombia; precios en COP.
