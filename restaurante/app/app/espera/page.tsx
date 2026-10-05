import { requireStaff } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/permissions';
import { Empty, PageTitle } from '@/components/ui';

export default async function WaitingPage() {
  const staff = await requireStaff();
  return (
    <div className="space-y-6">
      <PageTitle title={`Hola, ${staff.name}`} text={`Entraste como ${ROLE_LABEL[staff.role]}.`} />
      <Empty>Aquí aparecerán los pedidos que te mandan los meseros.</Empty>
    </div>
  );
}
