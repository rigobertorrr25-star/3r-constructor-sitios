// Fotos de muchos platos a la vez (Carta → «Subir fotos de los platos»): a cada foto se le busca su producto por el
// nombre del archivo («Mojito.jpg», «bandeja-paisa (2).jpeg»). Sirve en el navegador y en el servidor.

/** Nombre comparable: sin tildes, mayúsculas, signos ni tamaños («750ml», «Litro»), para que «Old Parr 750ml» y «Old Parr Litro» sean lo mismo. */
export function photoKey(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/\b\d+\s?(ml|cl|lt|l)\b/g, ' ')
    .replace(/\b(litro|litros|lt)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** El producto cuyo nombre calza con el nombre del archivo, o null. Primero igual; si no, el nombre más largo que aparezca completo. */
export function productForFile<P extends { id: string; name: string }>(fileName: string, products: P[]): P | null {
  const key = photoKey(fileName.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/\(\d+\)/g, ' ').replace(/[_-]+/g, ' '));
  if (key.length < 3) return null;
  const keyed = products.map((p) => ({ p, k: photoKey(p.name) })).filter((x) => x.k.length >= 3);
  const exact = keyed.find((x) => x.k === key);
  if (exact) return exact.p;
  const padded = ` ${key} `;
  const inside = keyed.filter((x) => padded.includes(` ${x.k} `)).sort((a, b) => b.k.length - a.k.length)[0];
  return inside?.p ?? null;
}
