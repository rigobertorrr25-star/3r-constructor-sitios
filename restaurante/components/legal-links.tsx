import Link from 'next/link';
import { getT } from '@/lib/i18n/server';

/** Enlaces a privacidad y términos para el pie de las páginas públicas (8 nov 2026). */
export async function LegalLinks({ className = '' }: { className?: string }) {
  const t = await getT();
  return (
    <p className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-center text-[12.5px] text-muted-foreground ${className}`}>
      <Link href="/privacidad" className="hover:text-foreground hover:underline">
        {t('Política de privacidad')}
      </Link>
      <Link href="/terminos" className="hover:text-foreground hover:underline">
        {t('Términos y condiciones')}
      </Link>
    </p>
  );
}
