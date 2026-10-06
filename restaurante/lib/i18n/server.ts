// Idioma de quien hace la petición (solo en el servidor).
import { cookies, headers } from 'next/headers';
import { LANG_COOKIE, isLang, langFromAcceptLanguage, makeT, tr, type Lang } from './index';

export async function getLang(): Promise<Lang> {
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(chosen)) return chosen;
  return langFromAcceptLanguage((await headers()).get('accept-language'));
}

/** Para las páginas del servidor: const t = await getT(); t('Guardar'). */
export async function getT() {
  return makeT(await getLang());
}

/** Traduce un texto ya armado (un error, una línea de auditoría) al idioma de quien pide. */
export async function trServer(text: string) {
  return tr(await getLang(), text);
}
