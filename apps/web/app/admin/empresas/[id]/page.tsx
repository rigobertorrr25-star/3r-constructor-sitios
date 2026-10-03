import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminSetCompanyStatusAction } from '@/app/empresa/actions';
import { AdminModulesForm } from '@/components/company-forms';
import { authedApi } from '@/lib/api';
import type { AdminCompany } from '@/lib/companies';

export const metadata: Metadata = { title: 'Empresa — Administración 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';

export default async function AdminCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await authedApi<AdminCompany>(`/admin/companies/${id}`);
  if (!res.ok) notFound();
  const c = res.data;
  const suspended = c.status === 'suspended';
  return (
    <>
      <Link href="/admin/empresas" className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Empresas
      </Link>
      <h1 className="mt-3 font-display text-[30px] font-bold tracking-tight text-foreground">{c.name}</h1>
      <p className="mt-1 text-[14.5px] text-muted-foreground">
        Dueño: {c.owner?.email ?? '—'} · {c.memberCount} personas
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <section className={card}>
          <h2 className="font-display text-[20px] font-semibold text-foreground">Módulos</h2>
          <p className="mt-1 mb-5 text-[14px] text-muted-foreground">
            Marca los que contrató. Los que están en construcción se habilitan cuando estén listos.
          </p>
          <AdminModulesForm companyId={c.id} catalog={c.catalog ?? []} enabled={c.modules} />
        </section>
        <section className={card}>
          <h2 className="font-display text-[17px] font-semibold text-foreground">Estado</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {suspended ? 'Suspendida: nadie de la empresa puede entrar. Los datos se conservan.' : 'Activa.'}
          </p>
          <form action={adminSetCompanyStatusAction} className="mt-4">
            <input type="hidden" name="companyId" value={c.id} />
            <input type="hidden" name="status" value={suspended ? 'active' : 'suspended'} />
            <button type="submit" className="w-full rounded-full border border-white/[0.12] px-5 py-2.5 text-[14px] transition hover:bg-white/[0.06]">
              {suspended ? 'Reactivar empresa' : 'Suspender empresa'}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
