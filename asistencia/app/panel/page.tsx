import type { Metadata } from 'next';
import Link from 'next/link';
import { CreateBusinessForm } from '@/components/panel-forms';
import { card } from '@/components/ui';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { redirect } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { listBusinesses } from '@/lib/store';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, 'businesses')} — ${t(lang, 'appName')}` };
}

export default async function PanelPage() {
  const viewer = await requireViewer();
  // Un jefe solo tiene su negocio: va directo a su reporte.
  if (viewer.role === 'manager') redirect(`/panel/${viewer.businessId}`);
  const lang = await getLang();
  const businesses = await listBusinesses();

  return (
    <>
      <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">{t(lang, 'businesses')}</h1>
      <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">{t(lang, 'businessesIntro')}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {businesses.map((business) => (
          <Link
            key={business.id}
            href={`/panel/${business.id}`}
            className={`${card} group flex items-center gap-4 transition hover:border-primary/40`}
          >
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 font-display text-[18px] font-bold text-primary"
            >
              {business.name.trim()[0]?.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[20px] font-semibold text-foreground">{business.name}</span>
              <span className="text-[14px] text-muted-foreground">
                {business.employees === 1 ? t(lang, 'employeesCountOne') : t(lang, 'employeesCount', { n: business.employees })}
              </span>
            </span>
            <span className="text-[14px] text-primary transition group-hover:translate-x-0.5">{t(lang, 'openBusiness')} →</span>
          </Link>
        ))}
      </div>

      <div className="mt-4">
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
