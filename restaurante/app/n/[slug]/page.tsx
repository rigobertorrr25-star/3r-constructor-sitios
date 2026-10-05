import { notFound, redirect } from 'next/navigation';
import { getStaff } from '@/lib/auth';
import { homeOf } from '@/lib/permissions';
import { getBusinessBySlug } from '@/lib/store';
import { StaffLoginForm } from '@/components/login-forms';
import { Lion, card } from '@/components/ui';

export default async function StaffLogin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const staff = await getStaff();
  if (staff?.businessSlug === slug) redirect(homeOf(staff.role));

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <Lion size={44} />
          <div>
            <h1 className="font-display text-[21px] font-bold text-foreground">{business.name}</h1>
            <p className="text-[13.5px] text-muted-foreground">Restaurant Control</p>
          </div>
        </div>
        <div className={`${card} mt-6`}>
          {business.isActive ? (
            <StaffLoginForm slug={business.slug} />
          ) : (
            <p className="text-[15px] text-muted-foreground">Este negocio está suspendido. Escríbele a 3R para reactivarlo.</p>
          )}
        </div>
      </div>
    </main>
  );
}
