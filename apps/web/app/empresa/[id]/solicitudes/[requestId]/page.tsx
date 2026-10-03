import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cancelRequestAction } from '@/app/empresa/requests-actions';
import { DecisionForm } from '@/components/request-forms';
import { authedApi } from '@/lib/api';
import { STATUS_LABEL, TYPE_LABEL, rangeText, type LeaveRequestDetail } from '@/lib/requests';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Solicitud — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });

type Step = { title: string; state: 'done' | 'current' | 'rejected' | 'skipped'; detail: string; note?: string | null };

function steps(r: LeaveRequestDetail): Step[] {
  const sent: Step = { title: 'Enviada', state: 'done', detail: `${r.member.name} · ${when.format(new Date(r.createdAt))}` };
  const rejected = r.status === 'rejected';
  // Certificados (sin paso del supervisor) o decididos por RR. HH. de una vez.
  const supervisorSkipped = !r.supervisorAt && r.status !== 'pending' && r.status !== 'cancelled';
  const sup: Step = r.supervisorAt
    ? {
        title: 'Supervisor',
        state: rejected && !r.hrAt ? 'rejected' : 'done',
        detail: `${rejected && !r.hrAt ? 'Rechazó' : 'Aprobó'} ${r.supervisorBy ?? ''} · ${when.format(new Date(r.supervisorAt))}`,
        note: r.supervisorNote,
      }
    : supervisorSkipped
      ? { title: 'Supervisor', state: 'skipped', detail: 'No hacía falta' }
      : {
          title: 'Supervisor',
          state: r.status === 'pending' ? 'current' : 'skipped',
          detail: r.status === 'pending' ? 'Esperando su respuesta' : '—',
        };
  const sameDecider = r.supervisorAt && r.hrAt && r.supervisorAt === r.hrAt;
  const hr: Step = r.hrAt
    ? {
        title: 'Recursos Humanos',
        state: rejected ? 'rejected' : 'done',
        detail: sameDecider ? 'Decidió en el mismo paso' : `${rejected ? 'Rechazó' : 'Confirmó'} ${r.hrBy ?? ''} · ${when.format(new Date(r.hrAt))}`,
        note: r.hrNote,
      }
    : {
        title: 'Recursos Humanos',
        state: r.status === 'supervisor_ok' ? 'current' : 'skipped',
        detail: r.status === 'supervisor_ok' ? 'Esperando su respuesta' : '—',
      };
  return [sent, sup, hr];
}

const DOT: Record<Step['state'], string> = {
  done: 'bg-[#5ee0a0]',
  current: 'bg-primary ring-4 ring-primary/25',
  rejected: 'bg-[#ff8a8c]',
  skipped: 'bg-white/20',
};

export default async function RequestPage({ params }: { params: Promise<{ id: string; requestId: string }> }) {
  const { id, requestId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<LeaveRequestDetail>(`/companies/${id}/requests/${requestId}`);
  if (res.status === 404 || res.status === 403) notFound();
  const r = res.data;
  const mine = r.member.id === company.me.memberId;

  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/solicitudes`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Solicitudes
      </Link>
      <div>
        <p className="text-[14px] text-muted-foreground">
          {mine ? 'Tu solicitud' : `${r.member.name}${r.member.jobTitle ? ` · ${r.member.jobTitle}` : ''}`}
        </p>
        <h2 className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{TYPE_LABEL[r.type]}</h2>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="rounded-full border border-white/[0.12] px-3 py-1 text-foreground">{STATUS_LABEL[r.status]}</span>
          {rangeText(r) ? <span className="text-muted-foreground">{rangeText(r)}</span> : null}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <section className={card} aria-labelledby="h-motivo">
          <h3 id="h-motivo" className="font-display text-[18px] font-semibold text-foreground">
            Motivo
          </h3>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">{r.reason}</p>
          {r.days > 0 ? (
            <p className="mt-4 text-[13.5px] text-muted-foreground">
              {r.days} {r.days === 1 ? 'día' : 'días'}, sin contar domingos.
            </p>
          ) : null}
        </section>

        <aside className="space-y-6">
          <section className={card} aria-labelledby="h-camino">
            <h3 id="h-camino" className="font-display text-[18px] font-semibold text-foreground">
              Aprobación
            </h3>
            <ol className="mt-5 space-y-5">
              {steps(r).map((s) => (
                <li key={s.title} className="flex gap-3">
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${DOT[s.state]}`} aria-hidden="true" />
                  <div>
                    <p className="text-[14.5px] font-medium text-foreground">{s.title}</p>
                    <p className="text-[13px] text-muted-foreground">{s.detail}</p>
                    {s.note ? <p className="mt-1 text-[13.5px] text-foreground/90">«{s.note}»</p> : null}
                  </div>
                </li>
              ))}
            </ol>
            {r.status === 'cancelled' ? <p className="mt-4 text-[13.5px] text-muted-foreground">Quien la pidió la canceló.</p> : null}
          </section>

          {r.type === 'certificate' && company.modules.some((m) => m.key === 'doc_generator' && m.enabled) && r.can.decide ? (
            <Link
              href={`/empresa/${id}/generador?member=${r.member.id}&template=employment_certificate`}
              className="inline-flex w-full justify-center rounded-full border border-primary/50 px-5 py-3 text-[14px] font-medium text-foreground transition hover:bg-primary/10"
            >
              Generar el certificado laboral
            </Link>
          ) : null}

          {r.can.decide ? (
            <section className={card} aria-labelledby="h-decidir">
              <h3 id="h-decidir" className="mb-4 font-display text-[18px] font-semibold text-foreground">
                {r.status === 'supervisor_ok' ? 'Confirmar como RR. HH.' : 'Tu decisión'}
              </h3>
              <DecisionForm companyId={id} requestId={r.id} />
            </section>
          ) : null}

          {r.can.cancel ? (
            <form action={cancelRequestAction}>
              <input type="hidden" name="companyId" value={id} />
              <input type="hidden" name="requestId" value={r.id} />
              <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                Cancelar mi solicitud
              </button>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
