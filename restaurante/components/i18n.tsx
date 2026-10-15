'use client';

import { createContext, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_COOKIE, makeT, tr, type Lang, type T } from '@/lib/i18n';

const LangContext = createContext<Lang>('es');

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** En un componente del navegador: const t = useT(); t('Guardar'). */
export function useT(): T {
  const lang = useLang();
  return useMemo(() => makeT(lang), [lang]);
}

/** Traduce un texto ya armado que llega del servidor (un error, un aviso). */
export function useTr() {
  const lang = useLang();
  return (text: string) => tr(lang, text);
}

/** Botón ES | EN: guarda el idioma de esta persona en este aparato (un año) y vuelve a pintar la página. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const lang = useLang();
  const router = useRouter();
  const pick = (next: Lang) => {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <div role="group" aria-label={lang === 'en' ? 'Language' : 'Idioma'} className={`inline-flex rounded-full border border-white/[0.1] p-0.5 text-[13px] ${className}`}>
      {(['es', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === lang}
          onClick={() => pick(l)}
          className={`rounded-full px-2.5 py-1 font-medium transition ${l === lang ? 'bg-white/[0.12] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
