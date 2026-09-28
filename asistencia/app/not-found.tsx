import { Lion, card } from '@/components/ui';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';

export default async function NotFound() {
  const lang = await getLang();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className={`${card} w-full max-w-[400px] space-y-4 text-center`}>
        <Lion size={72} className="mx-auto" alt={t(lang, 'lionAlt')} />
        <h1 className="font-display text-[22px] font-bold text-foreground">{t(lang, 'notFoundTitle')}</h1>
        <p className="text-[15px] text-muted-foreground">{t(lang, 'notFoundText')}</p>
      </div>
    </main>
  );
}
