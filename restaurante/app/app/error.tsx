'use client';

import { useEffect } from 'react';
import { primaryButton } from '@/components/ui';
import { useT } from '@/components/i18n';

/** Si algo falla (casi siempre, la conexión), se muestra esto en vez de una pantalla rota. Lo enviado con identificador no se duplica al reintentar. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => console.error(error), [error]);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="font-display text-[24px] font-bold">{offline ? t('Sin conexión') : t('Algo salió mal')}</h1>
      <p className="text-[15px] text-muted-foreground">
        {offline ? t('Revisa el internet del aparato. Cuando vuelva, toca Reintentar.') : t('Toca Reintentar. Si se repite, avísale al administrador.')}
      </p>
      <button type="button" className={primaryButton} onClick={reset}>
        {t('Reintentar')}
      </button>
    </div>
  );
}
