'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useT } from '@/components/i18n';

const KEY = 'rc_cookies_ok';

/**
 * Aviso de cookies (8 nov 2026, pedido de Rigoberto). Solo hay cookies necesarias (sesión, idioma, último restaurante):
 * basta con avisar una vez por equipo y enlazar la política. No sale dentro de la app ni en la pantalla de cocina.
 */
export function CookieNotice() {
  const t = useT();
  const path = usePathname() ?? '/';
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem(KEY));
    } catch {
      setShow(false);
    }
  }, []);
  if (!show || path.startsWith('/app') || path.startsWith('/admin')) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    setShow(false);
  };
  return (
    <div
      role="region"
      aria-label={t('Aviso de cookies')}
      className="fixed bottom-3 left-3 right-3 z-50 mx-auto flex max-w-[460px] items-center gap-3 rounded-2xl border border-white/[0.1] bg-[#0b0d18]/95 px-3.5 py-2.5 text-[13px] leading-snug text-muted-foreground shadow-2xl backdrop-blur"
    >
      <p>
        {t('Solo usamos cookies necesarias para tu sesión y tu idioma.')}{' '}
        <Link href="/privacidad" className="text-primary hover:underline">
          {t('Más información')}
        </Link>
      </p>
      <button type="button" onClick={close} className="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90">
        {t('Entendido')}
      </button>
    </div>
  );
}
