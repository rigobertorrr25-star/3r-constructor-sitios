// Idioma de quien ve la página (solo en el servidor): el que eligió con el botón ES | EN, o si nunca
// eligió, el de su navegador.
import { cookies, headers } from 'next/headers';
import { LANG_COOKIE, isLang, langFromAcceptLanguage, type Lang } from './i18n';

export async function getLang(): Promise<Lang> {
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(chosen)) return chosen;
  return langFromAcceptLanguage((await headers()).get('accept-language'));
}
