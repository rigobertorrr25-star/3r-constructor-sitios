import { requireStaff } from '@/lib/auth';
import { getMenu } from '@/lib/orders';
import { can } from '@/lib/permissions';
import { MenuEditor } from '@/components/menu-editor';
import { PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const staff = await requireStaff('orders.take');
  const menu = await getMenu(staff.businessId);
  const canEdit = can(staff.role, 'menu.edit');
  return (
    <div className="space-y-6">
      <PageTitle
        title="Carta"
        text={
          canEdit
            ? 'La misma carta para todas las sedes. Cada categoría va a cocina o a barra; un producto puede ir a otra estación. Los cambios de precio quedan en la auditoría y no tocan lo ya pedido.'
            : 'Marca aquí lo que se acabó: los meseros ya no lo podrán pedir hasta que vuelva a haber.'
        }
      />
      <MenuEditor categories={menu.categories} products={menu.products} canEdit={canEdit} />
    </div>
  );
}
