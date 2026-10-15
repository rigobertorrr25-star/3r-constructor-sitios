// Textos en inglés: carta en inglés (nombres y descripciones de productos y categorías).
// La llave es el texto exacto en español (con sus {huecos}).
export const en: Record<string, string> = {
  'Nombre en inglés': 'Name in English',
  'Descripción en inglés': 'Description in English',
  'Nombre en inglés (opcional)': 'Name in English (optional)',
  'Descripción en inglés (opcional)': 'Description in English (optional)',
  'Para la carta QR en inglés': 'For the English QR menu',
  // Importar carta (lib/menu-import.ts y components/menu-import.tsx)
  'Importar carta': 'Import menu',
  'Importando…': 'Importing…',
  'Pega la carta: el nombre de cada categoría en su propia línea y debajo sus productos, cada uno con su precio al final. Lo que ya existe no se repite; si el precio cambió, se actualiza.':
    'Paste the menu: each category name on its own line and its products below, each with its price at the end. Anything already there is not duplicated; if the price changed, it is updated.',
  'La carta es muy larga: pégala por partes (hasta 600 líneas).': 'The menu is too long: paste it in parts (up to 600 lines).',
  'No encontramos productos con precio. Pon cada producto en una línea con su precio al final.': 'We found no products with a price. Put each product on its own line with the price at the end.',
  'Línea {n}: el nombre es muy largo (hasta 80 letras).': 'Line {n}: the name is too long (up to 80 characters).',
  'Línea {n}: ese precio no parece correcto.': 'Line {n}: that price doesn’t look right.',
  'Línea {n}: escribe primero el nombre de la categoría (por ejemplo «Cervezas»).': 'Line {n}: write the category name first (for example “Beers”).',
  'Línea {n}: «{text}» no tiene precio y no sirve como categoría.': 'Line {n}: “{text}” has no price and doesn’t work as a category.',
  'Listo: {c} categorías nuevas, {p} productos nuevos y {u} precios cambiados; {s} sin cambios.': 'Done: {c} new categories, {p} new products and {u} prices changed; {s} unchanged.',
  'Importó la carta: {c} categorías nuevas, {p} productos nuevos y {u} precios cambiados': 'Imported the menu: {c} new categories, {p} new products and {u} prices changed',
  // Biblioteca de fotos de 3R (lib/photo-library.ts)
  'Fotos de la biblioteca de 3R': '3R photo library',
  '3R tiene fotos de las bebidas más comunes (cervezas, whisky, ron, aguardiente, tequila, cócteles…). Se ponen solas en los productos que no tienen foto; las que ya subiste no se tocan.':
    '3R has photos of the most common drinks (beers, whisky, rum, aguardiente, tequila, cocktails…). They go automatically on products without a photo; the ones you uploaded are not touched.',
  'Hay {n} productos sin foto.': '{n} products have no photo.',
  'Todos los productos tienen foto.': 'Every product has a photo.',
  'Poniendo fotos…': 'Adding photos…',
  'Poner fotos de la biblioteca': 'Add photos from the library',
  'Listo: {n} productos quedaron con foto.': 'Done: {n} products now have a photo.',
  'Sin foto en la biblioteca: {names}.': 'No photo in the library for: {names}.',
  'Puso {n} fotos de la biblioteca de 3R en la carta': 'Added {n} photos from the 3R library to the menu',
  'No pudimos leer las fotos de la biblioteca. Intenta otra vez en un momento.': 'We couldn’t read the library photos. Try again in a moment.',
};
