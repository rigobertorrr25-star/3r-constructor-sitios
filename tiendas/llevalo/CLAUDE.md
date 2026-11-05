# 3R Market (antes «Llévalo» y «Tienda online 3R») — dropshipping de Rigoberto con Dropi

Reglas generales: `docs/claude/instrucciones-globales.md`. No es de 3R ni de un cliente: no enlazar desde 3rpaginas.com.

## Estado

- **Qué es** (4 nov 2026, pedido de Rigoberto): página estática `index.html` con productos de Dropi, filtros por categoría y
  un pedido por producto contra entrega por WhatsApp 573107907194 (producto, color o tamaño, cantidad, total, referencia de
  Dropi y datos de envío). Un pedido por producto porque cada uno sale de su bodega y paga su envío.
- **Productos** (`PRODUCTS` en el script; costos y ganancia en `PRODUCTOS.md`): 20 escogidos por ganancia el 4 nov y, desde
  el 5 nov, los **más vendidos** según el ranking de Dropdata (Rigoberto tiene cuenta gratis: 2 productos al día; los
  manda por captura y se buscan en Dropi por nombre). Los más vendidos van primero con la etiqueta «Más vendido» (`top: true`).
  Rigoberto pidió (5 nov) priorizar lo que más se vende aunque deje menos. Productos con tamaños de distinto precio: `sizes`.
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
