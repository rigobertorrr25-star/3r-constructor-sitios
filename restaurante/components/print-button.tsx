'use client';

import { useT } from './i18n';

export function PrintButton({ className = 'rounded-full bg-black px-5 py-2 text-[14px] text-white' }: { className?: string }) {
  const t = useT();
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {t('Imprimir')}
    </button>
  );
}
