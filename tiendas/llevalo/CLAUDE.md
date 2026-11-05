# Llévalo — tienda de dropshipping de Rigoberto (Dropi)

Reglas generales: `docs/claude/instrucciones-globales.md`. No es de 3R ni de un cliente: no enlazar desde 3rpaginas.com.

## Estado

- **Qué es** (4 nov 2026, pedido de Rigoberto): página estática `index.html` con productos de Dropi, filtros por categoría y
  un pedido por producto contra entrega por WhatsApp 573107907194 (producto, color o tamaño, cantidad, total, referencia de
  Dropi y datos de envío). Un pedido por producto porque cada uno sale de su bodega y paga su envío.
- **Productos** (`PRODUCTS` en el script; costos y ganancia en `PRODUCTOS.md`): 20 escogidos por ganancia el 4 nov y, desde
  el 5 nov, los **más vendidos** según el ranking de Dropdata (Rigoberto tiene cuenta gratis: 2 productos al día; los
  manda por captura y se buscan en Dropi por nombre). Los más vendidos van primero con la etiqueta «Más vendido» (`top: true`).
  Rigoberto pidió (5 nov) priorizar lo que más se vende aunque deje menos. Productos con tamaños de distinto precio: `sizes`.
- **Diseño** (5 nov 2026, Rigoberto mandó un video de referencia: tienda de ropa con prendas colgadas): arriba una «pared» gris
  claro con un tubo y todos los productos colgados de ganchos (se desliza de lado); al tocar uno pasa al frente, los demás
  quedan borrosos, con etiquetas colgando al lado (precio y color o tamaño, que se pueden tocar), nombre en mayúsculas y
  «Pedir · pagas al recibir». Franja verde neón abajo con texto que corre. Las fotos usan `mix-blend-mode: multiply` para
  que el fondo blanco se funda con la pared: no poner `z-index`, `transform` ni `filter` en sus contenedores (rompen la
  mezcla). Debajo sigue la lista completa con categorías. Color de acento: verde neón `#39ff14` con texto oscuro.
- Sin réplicas de marcas, suplementos ni aparatos médicos. Fotos enlazadas del CDN de Dropi (desde la sesión no cargan; en
  el navegador sí), salvo el restaurador (`img/5417.jpg`).
- **Publicación: Cloudflare, no Vercel** (5 nov 2026, pedido de Rigoberto), igual que ZENOVA: proyecto `llevalo`, rama
  `main`, directorio raíz `tiendas/llevalo`, comando `mkdir -p _site && cp -r index.html img _site/`, salida `_site` (así
  `PRODUCTOS.md` y estas notas, que tienen costos, no quedan públicos). Si se crea como Worker:
  `npx wrangler deploy --assets=./_site --name=llevalo --compatibility-date=2026-10-01`. Entró a `main` con el PR #94.
  **Publicada el 5 nov 2026** como Worker (despliegue verde): **https://llevalo.rigoberto-rrr25.workers.dev** (la sesión no
  puede abrirla: el proxy la bloquea; Rigoberto la revisa desde el celular).
- **Textos para publicar** (5 nov 2026) en `TEXTOS.md`: Marketplace por producto, grupos de Facebook, estados de WhatsApp,
  mensaje a contactos, Instagram/TikTok y respuestas. No se publica (el despliegue solo copia `index.html` e `img`). Si cambian
  precios o productos, actualizarlo también.
- **Imágenes para publicar** (5 nov 2026): la misma tienda con `#publicar` (cuadradas) o `#historias` (verticales) muestra una
  tarjeta por producto (foto, nombre, precio, «Pagas cuando te llega», WhatsApp) para que Rigoberto les tome captura desde el
  celular (las fotos del CDN de Dropi no se pueden bajar desde la sesión). `refPhoto: true` pone «Imagen de referencia».
- Cuando entre un pedido: revisar al comprador con la huella de Dropi, confirmar por WhatsApp y crear el pedido en Dropi
  solo después de que Rigoberto confirme el resumen.
