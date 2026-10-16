'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Vuelve a pedir la página cada cierto tiempo (mesas, comandas y caja cambian solas).
 * Sin conexión no intenta: si Next no logra traer los datos, recarga la página entera y, sin internet,
 * el mesero se quedaría con una pantalla en blanco. Por eso primero confirma que el servidor responde.
 */
export function AutoRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let busy = false;
    const refresh = async () => {
      if (busy || document.visibilityState !== 'visible' || !navigator.onLine) return;
      busy = true;
      try {
        const res = await fetch('/api/salud', { cache: 'no-store' });
        if (res.ok) router.refresh();
      } catch {
        // Sin conexión: se intenta en la próxima vuelta.
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(refresh, everyMs);
    const onVisible = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [router, everyMs]);
  return null;
}
