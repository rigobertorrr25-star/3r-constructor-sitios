# ZENOVA (`clientes/zenova/`)

Reglas generales de trabajo (iguales en todos los proyectos de Rigoberto): ver `docs/claude/instrucciones-globales.md`
(se cargan desde el CLAUDE.md de la raíz).

## Estado (actualízalo cuando algo cambie: otras sesiones no recuerdan lo que se habló)

- **ZENOVA** (18 oct 2026): cliente nuevo, tienda de ropa deportiva para mujer. Página estática en `clientes/zenova/`
  (estructura del estilo que mandó el cliente, HNST Studio, con Raleway + Poppins; desde el 19 oct 2026 **solo negro y
  blanco** por pedido del cliente; los cuadritos de color de cada prenda sí llevan su color). Textos de la marca puestos por
  Rigoberto el 19 oct 2026 («Hecho para moverte. Diseñado para ti.», «Tu cuerpo, tu ritmo, tu momento.»). Pedido con carrito por WhatsApp 573043804481. 10 productos con precio de su lista; tallas
  según el catálogo (S y M; medias talla única; bolso sin talla); colores y fotos por prenda en `img/catalogo`; **al tocar un color cambia la foto de la prenda a ese color** (pedido de
  Rigoberto 20 oct 2026: se mantiene en cualquier rediseño). Rediseño del 20 oct 2026 «igual a alexandrabrand.co»
  (hecho con una grabación del celular de Rigoberto; la dirección no abre desde la sesión): menú hamburguesa + bolsa,
  portada, «Nueva temporada» (carrusel con el nombre sobre la foto), «Más vendidos» (carrusel de tarjetas con bolitas de
  color y botón de agregar, «Ver todo»), dos fotos grandes con «Ver más», Nosotros, Tienda con filtros, Cómo pedir,
  Instagram, pie negro con foto y WhatsApp flotante. Al tocar una prenda se abre su ficha (fotos, color, talla). Qué sale en
  cada carrusel: `SEASON` y `BEST` en el script. Conjunto Blue
  no está en el catálogo: quedó fuera. Vista previa: https://claude.ai/artifact/V3MKk9xT8aLB4RJahF7G4y.
  Instagram: https://www.instagram.com/zenovaoficial_/ (contacto y pie). Publicación: Rigoberto pidió una dirección gratis que empiece por «zenova» (proyecto de Vercel aparte, Root Directory
  `clientes/zenova`, nombre en minúsculas); publicada el 19 oct 2026 en el proyecto `zenovaoficial` de Vercel (equipo `3-r3`). Esa dirección de Vercel ya no existe: desde el 24 oct 2026 ZENOVA está en Cloudflare, **https://zenovaoficial.rigoberto-rrr25.workers.dev**.

## Este proyecto

- Página estática (un `index.html` y la carpeta `img`). Publicada en Cloudflare (ver el apartado «Hosting» del CLAUDE.md de la raíz).
