'use client';

import { useRouter } from 'next/navigation';
import { LANGS, LANG_COOKIE, t, type Lang } from '@/lib/i18n';

/** Botón ES | EN: guarda la elección en una cookie (un año) y vuelve a pintar la página en ese idioma. */
export function LangSwitch({ lang, className = '' }: { lang: Lang; className?: string }) {
  const router = useRouter();
  const choose = (next: Lang) => {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <div role="group" aria-label={t(lang, 'switchLanguage')} className={`inline-flex rounded-full border border-black/[0.12] p-0.5 text-[13px] ${className}`}>
      {LANGS.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={option === lang}
          onClick={() => choose(option)}
          className={`rounded-full px-3 py-1 font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${
            option === lang ? 'bg-black/[0.06] text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
