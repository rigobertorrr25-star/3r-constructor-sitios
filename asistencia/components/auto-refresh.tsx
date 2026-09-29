'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Vuelve a pedir la página cada cierto tiempo (el reporte muestra a quien está trabajando en este momento). */
export function AutoRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      // Si la pestaña no está a la vista no hace falta; al volver, se actualiza enseguida.
      if (document.visibilityState === 'visible') router.refresh();
    }, everyMs);
    const onVisible = () => document.visibilityState === 'visible' && router.refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router, everyMs]);
  return null;
}
