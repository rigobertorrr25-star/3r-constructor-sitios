// Dirección de la foto de un producto (sirve en el navegador y en el servidor). La versión cambia al subir otra.
export const productPhotoUrl = (productId: string, version: number | null | undefined) => (version ? `/foto/${productId}?v=${version}` : null);
