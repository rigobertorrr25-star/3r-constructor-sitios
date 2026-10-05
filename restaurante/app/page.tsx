import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStaff } from '@/lib/auth';
import { homeOf } from '@/lib/permissions';
import { FindBusinessForm } from '@/components/login-forms';
import { Lion, card } from '@/components/ui';

export default async function Home() {
  const staff = await getStaff();
  if (staff) redirect(homeOf(staff.role));
  // Tablet del restaurante: va directo al ingreso del último negocio usado aquí.
  const last = (await cookies()).get('rc_negocio')?.value;
  if (last && /^[a-z0-9-]{1,80}$/.test(last)) redirect(`/n/${last}`);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3">
          <Lion size={48} />
          <div>
            <p className="font-display text-[20px] font-bold text-foreground">Restaurant Control</p>
            <p className="text-[14px] text-muted-foreground">por 3R</p>
          </div>
        </div>
        <div className={`${card} mt-8`}>
          <h1 className="font-display text-[22px] font-bold text-foreground">Entra a tu restaurante</h1>
          <p className="mt-1 text-[14.5px] text-muted-foreground">Escribe el nombre corto de tu negocio, el que viene en el enlace que te dio tu administrador.</p>
          <div className="mt-6">
            <FindBusinessForm />
          </div>
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
