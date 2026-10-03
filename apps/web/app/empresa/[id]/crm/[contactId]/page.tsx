import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteContactAction } from '@/app/empresa/crm-actions';
import { ActivityForm, ContactForm } from '@/components/crm-forms';
import { authedApi } from '@/lib/api';
import { atLeast, type CompanyMember } from '@/lib/companies';
import { ACTIVITY_LABEL, STAGE_LABEL, type CrmContactDetail } from '@/lib/crm';
import { formatMoney } from '@/lib/orders';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Cliente — CRM 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
const memberName = (m: CompanyMember) => [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email;

export default async function ContactPage({ params }: { params: Promise<{ id: string; contactId: string }> }) {
  const { id, contactId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(contactId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const [res, { data: members }] = await Promise.all([
    authedApi<CrmContactDetail>(`/companies/${id}/crm/contacts/${contactId}`),
    authedApi<CompanyMember[]>(`/companies/${id}/members`),
  ]);
  if (res.status === 404 || res.status === 403) notFound();
  const contact = res.data;
  const options = members.filter((m) => m.status === 'active').map((m) => ({ id: m.id, name: memberName(m) }));

  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/crm`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Tablero
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[26px] font-bold tracking-tight text-foreground">{contact.name}</h2>
          <p className="text-[14.5px] text-muted-foreground">
            {[contact.organization, STAGE_LABEL[contact.stage], contact.valueCents ? formatMoney(contact.valueCents, 'COP') : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {contact.phone ? (
            <a
              href={`https://wa.me/${contact.phone.replace(/[^\d]/g, '').replace(/^(?=3\d{9}$)/, '57')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] hover:bg-white/[0.06]"
            >
              WhatsApp
            </a>
          ) : null}
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] hover:bg-white/[0.06]">
              Correo
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-start">
        <section className={card} aria-labelledby="h-datos">
          <h3 id="h-datos" className="mb-5 font-display text-[18px] font-semibold text-foreground">
            Datos
          </h3>
          <ContactForm companyId={id} contact={contact} members={options} />
          {atLeast(company.me.role, 'admin') ? (
            <form action={deleteContactAction} className="mt-5">
              <input type="hidden" name="companyId" value={id} />
              <input type="hidden" name="contactId" value={contact.id} />
              <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                Borrar este cliente
              </button>
            </form>
          ) : null}
        </section>

        <section className={card} aria-labelledby="h-historial">
          <h3 id="h-historial" className="mb-5 font-display text-[18px] font-semibold text-foreground">
            Historial
          </h3>
          <ActivityForm companyId={id} contactId={contact.id} />
          {contact.activities.length > 0 ? (
            <ol className="mt-6 space-y-4 border-t border-white/[0.06] pt-5">
              {contact.activities.map((a) => (
                <li key={a.id}>
                  <p className="text-[12.5px] text-muted-foreground">
                    <span className="text-foreground">{ACTIVITY_LABEL[a.kind] ?? a.kind}</span> · {when.format(new Date(a.createdAt))}
                    {a.author ? ` · ${a.author}` : ''}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground/90">{a.body}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 text-[14px] text-muted-foreground">Aquí queda cada llamada, mensaje, reunión y cambio de etapa.</p>
          )}
        </section>
      </div>
    </div>
  );
}
