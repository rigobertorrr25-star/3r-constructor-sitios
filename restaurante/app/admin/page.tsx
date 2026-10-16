import { adminLogoutAction } from '@/app/actions';
import { requireAdmin } from '@/lib/auth';
import { listBusinesses } from '@/lib/store';
import { BusinessToggle, CreateBusinessForm } from '@/components/admin-forms';
import { Empty, Lion, PageTitle, card, quietButton } from '@/components/ui';
import { LangSwitch } from '@/components/i18n';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  await requireAdmin();
  const businesses = await listBusinesses();
  const t = await getT();
  return (
    <div className="min-h-screen" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Lion size={36} />
            <span className="font-display text-[17px] font-bold">Restaurant Control · 3R</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LangSwitch />
            <form action={adminLogoutAction}>
              <button className={quietButton}>{t('Salir')}</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <PageTitle title={t('Negocios')} text={t('Cada negocio tiene su propio enlace de ingreso, sus sedes y su equipo. Sus datos no se mezclan con los de otro.')} />
        <section className={card}>
          <h2 className="font-display text-[19px] font-bold">{t('Crear un negocio')}</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">{t('Queda con su primera sede y su dueño (código 0001). El dueño agrega a su equipo desde la app.')}</p>
          <div className="mt-5">
            <CreateBusinessForm />
          </div>
        </section>
        {businesses.length === 0 ? (
          <Empty>{t('Todavía no hay negocios.')}</Empty>
        ) : (
          <ul className="space-y-3">
            {businesses.map((b) => (
              <li key={b.id} className={`${card} flex flex-wrap items-center justify-between gap-4`}>
                <div>
                  <p className="font-display text-[18px] font-semibold">
                    {b.name} {b.isActive ? null : <span className="ml-2 rounded-full bg-destructive/15 px-2.5 py-0.5 text-[12px] text-[#ffb4b5]">{t('Suspendido')}</span>}
                  </p>
                  <p className="mt-1 text-[14px] text-muted-foreground">
                    {t('Ingreso:')} <a className="text-primary hover:underline" href={`/n/${b.slug}`}>/n/{b.slug}</a> ·{' '}
                    {b.locationCount === 1 ? t('1 sede') : t('{n} sedes', { n: b.locationCount })} · {t('{n} en el equipo', { n: b.staffCount })} ·{' '}
                    {b.openTables === 1 ? t('1 mesa abierta') : t('{n} mesas abiertas', { n: b.openTables })}
                  </p>
                </div>
                <BusinessToggle id={b.id} active={b.isActive} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
