# Cómo rehacer los catálogos (no se publica: el despliegue solo copia `index.html` e `img`)

Necesita el entorno de la sesión que deja bajar fotos de `d39ru7awumhhs2.cloudfront.net`.

1. Bajar las fotos de cada producto a `catalogo/fotos/<id>.src` (la URL está en `PRODUCTS` de `index.html`).
2. `node herramientas/imagenes.mjs` → `catalogo/imagenes/cuadradas` y `historias` (usa `drawCard` de la tienda).
3. `node herramientas/catalogo-publicar.mjs` → `catalogo/3R-Market-catalogo-para-publicar.pdf`.
4. `node herramientas/catalogo-whatsapp.mjs` → `catalogo/3R-Market-catalogo-WhatsApp.pdf` y `catalogo/whatsapp/fotos-para-whatsapp/`.
5. Comprimir las carpetas en ZIP y mandarlas a Rigoberto. `catalogo/` está en `.gitignore`.

## Catálogo para Meta Commerce Manager (WhatsApp, Facebook, Instagram)

`node herramientas/catalogo-meta.mjs` → `catalogo/3R-Market-catalogo-Meta.csv` (un renglón por producto; el espejo, uno por
tamaño). Las fotos que lee Meta son `img/catalogo/<id>.jpg` (800×800, fondo blanco), copiadas de
`catalogo/whatsapp/fotos-para-whatsapp/`; si se agrega un producto, agregar su foto ahí y publicar la tienda ANTES de subir el
archivo. Los suplementos (Amua) quedan fuera porque Meta no los permite.
