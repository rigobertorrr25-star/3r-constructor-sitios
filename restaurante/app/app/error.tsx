'use client';

import { useEffect } from 'react';
import { primaryButton } from '@/components/ui';

/** Si algo falla (casi siempre, la conexión), se muestra esto en vez de una pantalla rota. Lo enviado con identificador no se duplica al reintentar. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="font-display text-[24px] font-bold">{offline ? 'Sin conexión' : 'Algo salió mal'}</h1>
      <p className="text-[15px] text-muted-foreground">
        {offline ? 'Revisa el internet del aparato. Cuando vuelva, toca Reintentar.' : 'Toca Reintentar. Si se repite, avísale al administrador.'}
      </p>
      <button type="button" className={primaryButton} onClick={reset}>
        Reintentar
      </button>
    </div>
  );
}
