# NÁRDIS (`clientes/nardis/`)

Reglas generales de trabajo (iguales en todos los proyectos de Rigoberto): ver `docs/claude/instrucciones-globales.md`
(se cargan desde el CLAUDE.md de la raíz).

## Estado (actualízalo cuando algo cambie: otras sesiones no recuerdan lo que se habló)

- **Tienda de perfumes** (6 nov 2026): cliente nuevo de Rigoberto. Todavía no hay nombre, logo, fotos, precios ni WhatsApp
  del cliente: Rigoberto pidió inventarlos por ahora. Marca de ejemplo **NÁRDIS, Casa de Perfumes**: 10 perfumes de autor
  inventados con nombres colombianos (Ámbar Nocturno, Flor de Cafeto, Cedro de Páramo, etc.), todos Eau de Parfum 20 %.
- Página estática de una sola hoja (`index.html`, sin carpeta de fotos todavía): los frascos están **dibujados** con el
  color del líquido de cada perfume, hasta que el cliente mande fotos.
- Qué tiene: portada con repisa de tres frascos, datos rápidos (20 %, 8 a 10 h, muestra de 5 ml, envío gratis desde
  $150.000), tienda con filtros (Para: ella / él / unisex; Familia: floral, amaderado, fresco y cítrico, ámbar y especias,
  dulce), ficha de cada perfume (notas de salida, corazón y fondo; duración y estela; tamaños 5, 30, 50 y 100 ml),
  «Encuentra tu aroma» (tres preguntas que recomiendan un perfume), tabla de concentraciones (colonia, EDT, EDP, extracto),
  cómo pedir, preguntas frecuentes, pie y WhatsApp flotante. Pedido con bolsa que arma el mensaje de WhatsApp.
- Diseño: fondo vino muy oscuro con acento ámbar, títulos en Bodoni Moda, texto en Hanken Grotesk, botones rectos.
  Una sola apariencia (oscura).
- Vista previa (6 nov 2026): https://claude.ai/artifact/BUvX9KpfSASfeuSfr8rXec (copia de `index.html` sin las etiquetas
  de inicio; al cambiar la página, volver a publicarla ahí).
- Dónde se cambia: número de WhatsApp en `WA` y `WA_TEXT` al inicio del script (hoy es de ejemplo: 573000000000);
  precios por nivel en `TIERS`; perfumes en `PRODUCTS`; envío gratis en `FREE_SHIP`. Instagram del pie es de ejemplo
  (@nardis.perfumes).

## Este proyecto

- Página estática (un `index.html`). Cuando el cliente la apruebe, publicarla en Cloudflare igual que ZENOVA
  (ver «Hosting» en el CLAUDE.md de la raíz; directorio raíz `clientes/nardis`).
