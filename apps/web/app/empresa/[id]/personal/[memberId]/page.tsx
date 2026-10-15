import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PersonalForm, WorkForm } from '@/components/employee-forms';
import { authedApi } from '@/lib/api';
import { ROLE_LABEL, atLeast } from '@/lib/companies';
import { CONTRACT_LABEL, dateText, personName, type EmployeeProfile } from '@/lib/employees';
import { formatMoney } from '@/lib/orders';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Ficha del empleado — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value || '—'}</dd>
    </div>
  );
}

export default async function EmployeePage({ params }: { params: Promise<{ id: string; memberId: string }> }) {
  const { id, memberId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<EmployeeProfile>(`/companies/${id}/employees/${memberId}`);
  if (res.status === 404 || res.status === 403) notFound();
  const profile = res.data;
  const self = profile.id === company.me.memberId;
  const w = profile.work;

  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/personal`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Portal del empleado
      </Link>
      <div>
        <h2 className="font-display text-[26px] font-bold tracking-tight text-foreground">{self ? 'Mi ficha' : personName(profile.user)}</h2>
        <p className="text-[14.5px] text-muted-foreground">
          {[self ? personName(profile.user) : null, profile.jobTitle, profile.area, ROLE_LABEL[profile.role]].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
        <section className={card} aria-labelledby="h-personal">
          <h3 id="h-personal" className="font-display text-[18px] font-semibold text-foreground">
            Datos personales
          </h3>
          <p className="mt-1 mb-5 text-[14px] text-muted-foreground">
            {self
              ? 'Solo los ves tú, Recursos Humanos y la administración de la empresa.'
              : 'Los ve la persona, Recursos Humanos y la administración de la empresa.'}
          </p>
          <PersonalForm companyId={id} profile={profile} self={self} />
        </section>

        <div className="space-y-6">
          <section className={card} aria-labelledby="h-empresa">
            <h3 id="h-empresa" className="font-display text-[18px] font-semibold text-foreground">
              En la empresa
            </h3>
            <dl className="mt-3 divide-y divide-white/[0.06] text-[14px]">
              <Row label="Correo" value={profile.user.email} />
              <Row label="Cargo" value={profile.jobTitle} />
              <Row label="Área" value={profile.area} />
              <Row label="Fecha de ingreso" value={profile.hiredAt ? dateText(profile.hiredAt) : null} />
            </dl>
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              El cargo, el área y la fecha de ingreso se cambian en{' '}
              {atLeast(company.me.role, 'hr') ? (
                <Link href={`/empresa/${id}/equipo`} className="underline underline-offset-2 hover:text-foreground">
                  Equipo
                </Link>
              ) : (
                'Equipo'
              )}
              .
            </p>
          </section>

          <section className={card} aria-labelledby="h-contrato">
            <h3 id="h-contrato" className="mb-4 font-display text-[18px] font-semibold text-foreground">
              Contrato
            </h3>
            {profile.can.work ? (
              <WorkForm companyId={id} profile={profile} />
            ) : (
              <>
                <dl className="divide-y divide-white/[0.06] text-[14px]">
                  <Row label="Tipo de contrato" value={w.contractType ? (CONTRACT_LABEL[w.contractType] ?? w.contractType) : null} />
                  <Row label="Fin del contrato" value={w.contractEnd ? dateText(w.contractEnd) : null} />
                  <Row label="Salario mensual" value={w.salary != null ? formatMoney(w.salary * 100, 'COP') : null} />
                  <Row label="Horario" value={w.schedule} />
                </dl>
                <p className="mt-3 text-[12.5px] text-muted-foreground">Estos datos los pone Recursos Humanos. Si algo está mal, avísales.</p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
