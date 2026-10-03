import type { Metadata } from 'next';
import { InviteForm, MemberRow } from '@/components/company-forms';
import { revokeInviteAction } from '@/app/empresa/actions';
import { authedApi } from '@/lib/api';
import { ROLE_LABEL, atLeast, outranks, type CompanyInvite, type CompanyMember } from '@/lib/companies';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Equipo — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const expires = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' });

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  const me = company.me;
  const isAdmin = atLeast(me.role, 'admin');
  const [{ data: members }, invites] = await Promise.all([
    authedApi<CompanyMember[]>(`/companies/${id}/members`),
    isAdmin ? authedApi<CompanyInvite[]>(`/companies/${id}/invites`).then((r) => (r.ok ? r.data : [])) : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:items-start">
      <section className={card} aria-labelledby="h-equipo">
        <h2 id="h-equipo" className="font-display text-[20px] font-semibold text-foreground">
          Equipo <span className="text-muted-foreground">· {members.length}</span>
        </h2>
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {members.map((member) => {
            const isSelf = member.id === me.memberId;
            const above = outranks(me.role, member.role);
            return (
              <MemberRow
                key={member.id}
                companyId={id}
                member={member}
                isSelf={isSelf}
                actorRole={me.role}
                canEditProfile={atLeast(me.role, 'hr') && (above || isSelf)}
                canEditRole={isAdmin && member.role !== 'owner' && above}
                canRemove={member.role !== 'owner' && (isSelf || (isAdmin && above))}
              />
            );
          })}
        </ul>
      </section>

      {isAdmin ? (
        <div className="space-y-6">
          <section className={card} aria-labelledby="h-invitar">
            <h2 id="h-invitar" className="font-display text-[20px] font-semibold text-foreground">
              Invitar a alguien
            </h2>
            <p className="mt-1 mb-5 text-[14px] text-muted-foreground">
              Le llega un correo para unirse con su propia cuenta. Si no tiene, la crea con ese correo.
            </p>
            <InviteForm companyId={id} actorRole={me.role} />
          </section>
          {invites.length > 0 ? (
            <section className={card} aria-labelledby="h-pendientes">
              <h2 id="h-pendientes" className="font-display text-[17px] font-semibold text-foreground">
                Invitaciones pendientes
              </h2>
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] text-foreground">{invite.email}</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {ROLE_LABEL[invite.role]} · vence el {expires.format(new Date(invite.expiresAt))}
                      </p>
                    </div>
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="companyId" value={id} />
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                        Cancelar
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
