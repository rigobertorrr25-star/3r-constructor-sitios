/** Convierte un nombre en un slug URL: sin tildes, en minúsculas y con guiones. */
export function slugify(input: string, fallback = 'sitio'): string {
  const slug = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || fallback;
}

/** Devuelve `base`, o `base-2`, `base-3`… hasta encontrar uno que no esté ocupado. */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  let candidate = base;
  for (let n = 2; await isTaken(candidate); n++) {
    candidate = `${base}-${n}`;
  }
  return candidate;
}
