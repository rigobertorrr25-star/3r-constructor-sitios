import { requireStaff } from '@/lib/auth';
import { assignableRoles } from '@/lib/permissions';
import { listLocations, listStaff } from '@/lib/store';
import { CreateStaffForm, StaffRow } from '@/components/staff-forms';
import { PageTitle, card } from '@/components/ui';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const staff = await requireStaff('staff.manage');
  const [members, locations] = await Promise.all([listStaff(staff), listLocations(staff.businessId, { activeOnly: true })]);
  const roles = assignableRoles(staff.role);
  const t = await getT();
  const sedes = locations.map(({ id, name }) => ({ id, name }));
  return (
    <div className="space-y-6">
      <PageTitle
        title={t('Equipo')}
        text={t('Cada persona entra en la página de inicio: escoge el restaurante, toca su nombre y pone su PIN (o directo en {path}). Dos personas activas no pueden llamarse igual. Nadie se borra: se desactiva y su historial queda.', { path: `/n/${staff.businessSlug}` })}
      />
      <section className={card}>
        <h2 className="font-display text-[18px] font-bold">{t('Agregar a alguien')}</h2>
        <div className="mt-4">
          <CreateStaffForm roles={roles} locations={sedes} />
        </div>
      </section>
      <ul className="space-y-3">
        {members.map((m) => (
          <StaffRow
            key={m.id}
            member={{ ...m, lockedUntil: m.lockedUntil && m.lockedUntil > new Date() ? m.lockedUntil.toISOString() : null, createdAt: m.createdAt.toISOString() }}
            roles={roles}
            locations={sedes}
            editable={roles.includes(m.role)}
            isMe={m.id === staff.id}
          />
        ))}
      </ul>
    </div>
  );
}
