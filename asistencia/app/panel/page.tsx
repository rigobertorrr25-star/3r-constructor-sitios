import type { Metadata } from 'next';
import Link from 'next/link';
import { CreateBusinessForm } from '@/components/panel-forms';
import { card } from '@/components/ui';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { listBusinesses } from '@/lib/store';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, 'businesses')} — ${t(lang, 'appName')}` };
}

export default async function PanelPage() {
  const lang = await getLang();
  const businesses = await listBusinesses();

  return (
    <>
      <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">{t(lang, 'businesses')}</h1>
      <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">{t(lang, 'businessesIntro')}</p>

      <div className="mt-8 space-y-4">
        {businesses.map((business) => (
          <Link
            key={business.id}
            href={`/panel/${business.id}`}
            className={`${card} flex flex-wrap items-center justify-between gap-2 transition hover:border-white/[0.16]`}
          >
            <span className="font-display text-[20px] font-semibold text-foreground">{business.name}</span>
            <span className="text-[14px] text-muted-foreground">
              {business.employees === 1 ? t(lang, 'employeesCountOne') : t(lang, 'employeesCount', { n: business.employees })}
            </span>
          </Link>
        ))}

        <details className={card} open={businesses.length === 0}>
          <summary className="cursor-pointer font-display text-[20px] font-semibold text-foreground">{t(lang, 'addBusiness')}</summary>
          <div className="mt-5 max-w-md">
            <CreateBusinessForm lang={lang} />
          </div>
        </details>
      </div>
    </>
  );
}
