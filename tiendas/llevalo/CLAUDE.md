# 3R Market (antes «Llévalo» y «Tienda online 3R») — dropshipping de Rigoberto con Dropi

Reglas generales: `docs/claude/instrucciones-globales.md`. No es de 3R ni de un cliente: no enlazar desde 3rpaginas.com.

## Estado

- **Qué es** (4 nov 2026, pedido de Rigoberto): página estática `index.html` con productos de Dropi, filtros por categoría y
  un pedido por producto contra entrega por WhatsApp 573107907194 (producto, color o tamaño, cantidad, total, referencia de
  Dropi y datos de envío). Un pedido por producto porque cada uno sale de su bodega y paga su envío.
- **Productos** (`PRODUCTS` en el script; costos y ganancia en `PRODUCTOS.md`): 20 escogidos por ganancia el 4 nov y, desde
  el 5 nov, los **más vendidos** según el ranking de Dropdata (Rigoberto tiene cuenta gratis: 2 productos al día; los
  manda por captura y se buscan en Dropi por nombre). Los más vendidos van primero con la etiqueta «Más vendido» (`top: true`).
  Rigoberto pidió (5 nov) priorizar lo que más se vende aunque deje menos. Agregados del ranking: 5 nov luces para espejo (#11)
  y espejo de pared (#14); 17 nov Amua Vital Drops (2312645, 784 ventas en 7 días) y carillas dentales removibles (2322158,
  en Dropi «Implantes dentales», 1.068 ventas en 7 días; se llaman carillas porque no son implantes). Productos con tamaños de distinto precio: `sizes`.
- **Diseño** (5 nov 2026, con un video de referencia de Rigoberto): arriba una **vitrina que rueda sola y sin parar**
  (más despacio cuando un producto pasa por el centro). El del centro va grande sobre una tarjeta blanca que flota; los de
  los lados, más pequeños, girados y borrosos. Debajo: nombre en mayúsculas, etiqueta verde con el precio, etiquetas de
  color o tamaño (se pueden tocar) y «Pedir · pagas al recibir». Al tocar, deslizar o usar las flechas, se detiene 7 s y
  luego sigue rodando. Rigoberto pidió quitar los ganchos («no son ropa») y que los productos «vayan rodando». Franja verde
  neón abajo con texto que corre. Debajo sigue la lista completa con categorías. Acento: verde neón `#39ff14` con texto oscuro.
- **Marca y ventas** (5 nov 2026, pedido de Rigoberto): se llama **«3R Market»** (escogido por Rigoberto el 5 nov 2026 entre 3R Market, Pídelo.3R y 3RYA; no le gustó «Tienda online 3R». Logo: «3R» en negro con letras verde neón + «MARKET», frase «Recibe · Revisa · Paga al recibir»; la carpeta y el
  proyecto de Cloudflare siguen como `llevalo`). Precios **no redondos** (tipo $42.300, todos en `PRODUCTOS.md`). Colores: botón
  «Pedir» y precio en rojo-naranja `#e8380d` (acción, oferta, alto contraste con la pared gris); verde neón para confianza
  (franja, «Más vendido», el «3R» del logo). Mensajes: «Pagas cuando te llega», «Envío gratis», «Te confirmamos por WhatsApp
  antes de enviar», «Pide con tiempo para Navidad». No inventar reseñas, escasez ni descuentos falsos.
- **Título del inicio** (5 nov 2026, Rigoberto pidió uno mejor y con mejor diseño): «Lo mejor para tu [palabra] llega a tu puerta.
  Pagas al recibirlo.». La palabra cambia sola cada 2,2 s (casa, moto, cocina, carro, mascota, Navidad) en rojo-naranja; «Pagas al
  recibirlo» va resaltado en verde. Debajo, tres recuadros con ✓ (envío gratis, efectivo al recibir, confirmación por WhatsApp).
- **Distribución del inicio** (5 nov 2026, a Rigoberto no le gustó la anterior): barra con el logo 3R Market a la izquierda y
  botón negro «Escríbenos» (WhatsApp) a la derecha; título alineado a la izquierda («Lo mejor para tu [palabra] llega a tu
  puerta.» + «Pagas al recibirlo.» resaltado); la vitrina se ve sin bajar; debajo, franja blanca con 3 columnas e íconos (envío
  gratis, pagas al recibir, te confirmamos). En computador, título a la izquierda y vitrina a la derecha. El botón flotante de
  WhatsApp solo aparece cuando ya no se ve «Escríbenos». Ojo: la clase vieja `.hero` sigue en el CSS (fondo oscuro); la nueva
  es `.hero3`.
- Sin réplicas de marcas. Al principio también se dejaron por fuera suplementos y aparatos médicos (criterio de Claude, no de
  Rigoberto); desde el 17 nov 2026 entran si están en el ranking de Dropdata (Rigoberto pidió lo que más se vende), pero sin
  prometer curas ni efectos de salud, y un suplemento solo se despacha si en Dropi tiene registro INVIMA. Fotos enlazadas del CDN de Dropi (desde la sesión no cargan; en
  el navegador sí), salvo el restaurador (`img/5417.jpg`).
- **Publicación: Cloudflare, no Vercel** (5 nov 2026, pedido de Rigoberto), igual que ZENOVA: proyecto `llevalo`, rama
  `main`, directorio raíz `tiendas/llevalo`, comando `mkdir -p _site && cp -r index.html img publico/. _site/` (desde el 8 nov 2026; antes sin `publico/.`), salida `_site` (así
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
- **Los 5 mejores para publicar** (5 nov 2026): `#top5` muestra 5 tarjetas (luces para espejo, espejo de pared, cuchillos, tina
  spa, destornillador) con su texto y botón «Copiar texto» (`TOP5` en el script; si cambian precios, cambiarlos ahí también).
- **Descargar imágenes** (5 nov 2026): en `#publicar`, `#historias` y `#top5` cada tarjeta tiene «Descargar imagen», que la
  dibuja en un canvas (1080×1080 o 1080×1920) y la guarda; en el celular abre el menú de compartir (galería, WhatsApp). Funciona
  porque el CDN de Dropi responde `access-control-allow-origin: *` (comprobado el 5 nov 2026); si eso cambia, solo queda la captura.
- **Catálogo para publicar** (17 nov 2026, pedido de Rigoberto): PDF `3R-Market-catalogo-para-publicar.pdf` (guía para publicar en
  otras ciudades, plan semanal por ciudad, mensajes y cada producto con imagen, título, precio y texto) y ZIP con las imágenes
  cuadradas y verticales. Se arma en `catalogo/` (ignorado por git) con scripts de Playwright que usan `drawCard` de la tienda.
  Desde el 17 nov la sesión usa el entorno «3r-constructor-sitios», que deja bajar las fotos del CDN de Dropi
  (`d39ru7awumhhs2.cloudfront.net`) y abrir la tienda. El adaptador angular es un GIF que empieza en negro: para las imágenes
  descargables usa `cardImg: "img/2238229.jpg"`. Si cambian productos o precios, rehacer el catálogo.
- **Más productos y catálogo de WhatsApp Business** (17 nov 2026, pedido de Rigoberto: «quiero más productos», «con buena
  rentabilidad», «mete bastantes perfumes», «armar una tienda en mi WhatsApp» con un PDF «separado por secciones»): 29 productos
  nuevos (53 en total; lista y ganancias en `PRODUCTOS.md`), secciones nuevas «Perfumes» y «Tecnología», «Regalos» pasa a
  «Regalos y Navidad». La vitrina de arriba ya no muestra todos: solo `top: true` y los marcados `vitrina: true` (`SHOW`).
  PDF `3R-Market-catalogo-WhatsApp.pdf` (guía para montar el catálogo y las colecciones + cada producto con foto, nombre, precio,
  descripción, enlace y código `3R-<id de Dropi>`) y ZIP con fotos limpias por sección; se arma con `catwa.mjs` en `catalogo/`.
  Rigoberto dijo (17 nov) que «hay muchos productos que no me gustan» pero no dijo cuáles: preguntarle antes de quitar.
- Cuando entre un pedido: revisar al comprador con la huella de Dropi, confirmar por WhatsApp y crear el pedido en Dropi
  solo después de que Rigoberto confirme el resumen.

- **Los 20 puntos antes de publicar** (8 nov 2026, video de Rigoberto): igual que ZENOVA (ventanas legales, OG, ícono, `publico/`, `wrangler.jsonc`); botón rojo-naranja pasó a `#d4320b` y verde de texto a `#0f7400` por contraste. Comando de compilación: `mkdir -p _site && cp -r index.html img publico/. _site/`.
