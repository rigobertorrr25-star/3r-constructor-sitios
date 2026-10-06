import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStaff } from '@/lib/auth';
import { ROLE_LABEL, homeOf } from '@/lib/permissions';
import { getBusinessBySlug, listLoginPeople } from '@/lib/store';
import { StaffLoginForm } from '@/components/login-forms';
import { Lion, card } from '@/components/ui';
import { BackgroundLayer } from '@/components/background-forms';
import { backgroundUrl } from '@/lib/background-url';
import { backgroundVersion } from '@/lib/backgrounds';
import { LangSwitch } from '@/components/i18n';
import { getT } from '@/lib/i18n/server';

export default async function StaffLogin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getT();
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  // En la tablet compartida siempre se muestra el teclado: otra persona puede entrar sin que la anterior salga.
  // Quien ya tiene la sesión abierta sigue con un toque.
  const staff = await getStaff();
  const current = staff?.businessSlug === slug ? staff : null;
  const people = business.isActive ? await listLoginPeople(business.slug) : [];
  const background = business.isActive ? backgroundUrl(business.slug, await backgroundVersion(business.id)) : null;

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <BackgroundLayer url={background} />
      <LangSwitch className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <Lion size={44} />
          <div>
            <h1 className="font-display text-[21px] font-bold text-foreground">{business.name}</h1>
            <p className="text-[13.5px] text-muted-foreground">Restaurant Control</p>
          </div>
        </div>
        {current && business.isActive ? (
          <Link
            href={homeOf(current.role)}
            className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-[14.5px] transition hover:bg-primary/15"
          >
            <span>
              {t('Sesión abierta:')} <strong>{current.name}</strong> ({t(ROLE_LABEL[current.role])})
            </span>
            <span className="text-primary">{t('Seguir →')}</span>
          </Link>
        ) : null}
        <div className={`${card} mt-6`}>
          {current && business.isActive ? <p className="mb-4 text-[14px] text-muted-foreground">{t('¿Es otra persona? Que toque su nombre y ponga su PIN.')}</p> : null}
          {business.isActive ? (
            <StaffLoginForm slug={business.slug} people={people} />
          ) : (
            <p className="text-[15px] text-muted-foreground">{t('Este negocio está suspendido. Escríbele a 3R para reactivarlo.')}</p>
          )}
        </div>
      </div>
    </main>
  );
}
