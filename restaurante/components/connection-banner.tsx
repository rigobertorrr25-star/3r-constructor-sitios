'use client';

import { useEffect, useState } from 'react';
import { useT } from './i18n';

/** Aviso fijo cuando el aparato pierde la conexión con el servidor. Revisa cada 15 s mientras está caído. */
export function ConnectionBanner() {
  const t = useT();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch('/api/salud', { cache: 'no-store' });
        if (alive) setOnline(res.ok);
      } catch {
        if (alive) setOnline(false);
      }
    };
    const goOffline = () => setOnline(false);
    const goOnline = () => void check();
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    if (!navigator.onLine) setOnline(false);
    const timer = setInterval(() => {
      if (!navigator.onLine) setOnline(false);
      else void check();
    }, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-50 border-t border-warning/40 bg-[#1a1405] px-4 py-3 text-center text-[14px] text-warning">
      {t('Sin conexión. Lo que envíes queda guardado en este aparato y se manda solo cuando vuelva el internet (sin duplicarse).')}
    </div>
  );
}
