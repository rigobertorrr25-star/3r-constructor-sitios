import { requireStaff } from '@/lib/auth';
import { assignableRoles } from '@/lib/permissions';
import { listLocations, listStaff } from '@/lib/store';
import { CreateStaffForm, StaffRow } from '@/components/staff-forms';
import { PageTitle, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const staff = await requireStaff('staff.manage');
  const [members, locations] = await Promise.all([listStaff(staff), listLocations(staff.businessId, { activeOnly: true })]);
  const roles = assignableRoles(staff.role);
  const sedes = locations.map(({ id, name }) => ({ id, name }));
  return (
    <div className="space-y-6">
      <PageTitle title="Equipo" text={`Cada persona entra en /n/${staff.businessSlug} con su código y su PIN. Nadie se borra: se desactiva y su historial queda.`} />
      <section className={card}>
        <h2 className="font-display text-[18px] font-bold">Agregar a alguien</h2>
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
