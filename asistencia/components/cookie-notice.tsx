'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { t, type Lang } from '@/lib/i18n';

const KEY = 'asis_cookies_ok';

/** Aviso de cookies (8 nov 2026): solo hay cookies necesarias (sesión e idioma); sale una vez por equipo. */
export function CookieNotice({ lang }: { lang: Lang }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem(KEY));
    } catch {
      setShow(false);
    }
  }, []);
  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    setShow(false);
  };
  return (
    <div
      role="region"
      aria-label={t(lang, 'cookieRegion')}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-[460px] items-center gap-3 rounded-2xl bg-[#0d2c44] px-3.5 py-2.5 text-[13px] leading-snug text-white shadow-2xl"
    >
      <p>
        {t(lang, 'cookieText')}{' '}
        <Link href="/privacidad" className="underline">
          {t(lang, 'cookieMore')}
        </Link>
      </p>
      <button type="button" onClick={close} className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0d2c44] hover:bg-white/90">
        {t(lang, 'cookieOk')}
      </button>
    </div>
  );
}
