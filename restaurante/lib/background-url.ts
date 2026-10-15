// Dirección del fondo de un restaurante (sirve en el navegador y en el servidor). La versión cambia al subir otro.
export const backgroundUrl = (slug: string, version: number | null | undefined) => (version ? `/fondo/${slug}?v=${version}` : null);
