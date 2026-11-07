'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const KEY = '3r_cookies_ok';

/**
 * Aviso de cookies (8 nov 2026, pedido de Rigoberto). 3R solo usa las cookies necesarias para la sesión, así que basta
 * con avisar y enlazar la política; no hay nada que aceptar o rechazar. Sale una vez por navegador. No sale en las
 * muestras ni en las tiendas de los clientes (son páginas de ellos, no de 3R).
 */
export function CookieNotice() {
  const path = usePathname() ?? '/';
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem(KEY));
    } catch {
      setShow(false);
    }
  }, []);
  if (!show || path.startsWith('/muestra') || path.startsWith('/tienda')) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    setShow(false);
  };
  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed bottom-3 left-3 right-[84px] z-40 flex max-w-[460px] items-center gap-3 rounded-2xl border border-white/[0.1] bg-[#0d1024]/95 px-3.5 py-2.5 text-[13px] leading-snug text-muted-foreground shadow-2xl backdrop-blur sm:right-auto"
    >
      <p>
        Solo usamos cookies necesarias para tu sesión.{' '}
        <Link href="/privacidad" className="text-primary underline-offset-2 hover:underline">
          Más información
        </Link>
      </p>
      <button
        type="button"
        onClick={close}
        className="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        Entendido
      </button>
    </div>
  );
}
