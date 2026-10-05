import Link from 'next/link';
import { cookies } from 'next/headers';
import { getStaff } from '@/lib/auth';
import { ROLE_LABEL, homeOf } from '@/lib/permissions';
import { listActiveBusinesses, listLoginPeople } from '@/lib/store';
import { FindBusinessForm, RestaurantLogin } from '@/components/login-forms';
import { Lion, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Ingreso de todos los restaurantes: se escoge el restaurante y se entra con código y PIN.
  // La tablet recuerda el último restaurante usado; quien ya tiene sesión abierta sigue con un toque.
  const [staff, businesses, jar] = await Promise.all([getStaff(), listActiveBusinesses().catch(() => null), cookies()]);
  const last = jar.get('rc_negocio')?.value;
  const known = (slug?: string) => (slug && businesses?.some((b) => b.slug === slug) ? slug : '');
  const initialSlug = known(staff?.businessSlug) || known(last) || (businesses?.length === 1 ? businesses[0].slug : '');
  const initialPeople = initialSlug ? await listLoginPeople(initialSlug).catch(() => null) : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <Lion size={48} />
          <div>
            <p className="font-display text-[20px] font-bold text-foreground">Restaurant Control</p>
            <p className="text-[14px] text-muted-foreground">por 3R</p>
          </div>
        </div>
        {staff ? (
          <Link
            href={homeOf(staff.role)}
            className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-[14.5px] transition hover:bg-primary/15"
          >
            <span>
              Sesión abierta: <strong>{staff.name}</strong> ({ROLE_LABEL[staff.role]})
            </span>
            <span className="text-primary">Seguir →</span>
          </Link>
        ) : null}
        <div className={`${card} mt-6`}>
          <h1 className="font-display text-[22px] font-bold text-foreground">Entra a tu restaurante</h1>
          <p className="mb-5 mt-1 text-[14.5px] text-muted-foreground">Escoge tu restaurante, toca tu nombre y escribe tu PIN.</p>
          {businesses === null ? (
            <FindBusinessForm />
          ) : businesses.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">Todavía no hay restaurantes activos.</p>
          ) : (
            <RestaurantLogin businesses={businesses} initialSlug={initialSlug} initialPeople={initialPeople} />
          )}
        </div>
        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          ¿Eres de 3R?{' '}
          <Link href="/admin" className="text-primary hover:underline">
            Administración
          </Link>
        </p>
      </div>
    </main>
  );
}
