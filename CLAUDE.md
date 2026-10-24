# 3R — Proyectos de Rigoberto

Reglas generales de trabajo (iguales en todos los proyectos de Rigoberto):
@docs/claude/instrucciones-globales.md

## Un proyecto por conversación (24 oct 2026, pedido de Rigoberto)

Cada proyecto se trabaja en su propia conversación y tiene sus propias notas. **Antes de empezar, lee solo el CLAUDE.md
del proyecto en que vas a trabajar** (si no sabes cuál es, pregúntale a Rigoberto en una línea) y no toques las carpetas
de los demás salvo que él lo pida. Cuando algo cambie, actualiza las notas de ese proyecto, no las de otro.

| Proyecto | Carpeta | Notas |
| --- | --- | --- |
| Restaurant Control (software para restaurantes y bares: Azul Caribe, DELIRIUM) | `restaurante/` | `restaurante/CLAUDE.md` |
| Asistencia con QR | `asistencia/` | `asistencia/CLAUDE.md` |
| Tienda 3R (3rpaginas.com, muestras de venta, plataforma empresarial) | `apps/web`, `apps/api` | `apps/CLAUDE.md` |
| ZENOVA (cliente, tienda de ropa) | `clientes/zenova/` | `clientes/zenova/CLAUDE.md` |
| Instagram, contenido y ventas de 3R | `marketing/` | `marketing/CLAUDE.md` |

## Para todos los proyectos

- **Vercel publica cada proyecto solo si cambió su carpeta** (23 oct 2026, pedido de Rigoberto tras llegar al límite gratis de 100 publicaciones al día): `ignoreCommand` en el `vercel.json` de `apps/web` (también mira `packages/` y el `package.json`/lock de la raíz), `asistencia` y `restaurante`, comparando con la última publicación (`VERCEL_GIT_PREVIOUS_SHA`). Un proyecto nuevo de Vercel en este repo debe llevar su propio `vercel.json` con lo mismo. **Cambios en paquetes** (23 oct 2026, Rigoberto: «cada 10 cambios lo mandamos a Vercel, no mandemos cambios uno por uno»): los cambios se juntan en la rama de trabajo y se abre un solo PR cada ~10 cambios (o cuando él lo pida); las ramas `claude/**` no publican vista previa en Vercel (`git.deploymentEnabled` en cada `vercel.json`), solo `main` publica. Llevar la cuenta de los cambios del paquete en `PENDIENTES.md`. **Hosting** (24 oct 2026, decisión de Rigoberto): el plan gratis de Vercel es solo para uso no comercial; él no paga Pro hasta tener el primer cliente que pague (entonces pasar a Pro y cobrar «hosting y mantenimiento» en la cotización). Mientras tanto, la página estática de ZENOVA pasa a Cloudflare gratis (proyecto `zenovaoficial`, rama `main`, sin vistas previas, directorio raíz `clientes/zenova`, comando `mkdir -p _site && cp -r index.html img _site/` y salida `_site`; si se crea como Worker, despliegue `npx wrangler deploy --assets=./_site --name=zenovaoficial --compatibility-date=2026-10-01`); creado por Rigoberto el 24 oct 2026 como Worker (despliegue verde): **https://zenovaoficial.rigoberto-rrr25.workers.dev** (la sesión no puede abrirla: el proxy la bloquea). El proyecto `zenovaoficial` de Vercel se borró el 24 oct 2026 (Rigoberto) y se quitó `clientes/zenova/vercel.json`. La tienda, Restaurant Control y Asistencia se quedan en Vercel (en Cloudflare gratis no caben: 3 MB por Worker).
- Textos visibles para el usuario, en español de Colombia; precios en COP.
- Cada conversación tiene su propia rama de trabajo y su propio paquete de cambios (la cuenta va en `PENDIENTES.md`,
  apartado de ese proyecto). Si dos conversaciones tocan el mismo archivo de la raíz (este CLAUDE.md, `package.json`),
  la segunda que se una a `main` puede tener conflicto: resolverlo trayendo `main` a la rama.
