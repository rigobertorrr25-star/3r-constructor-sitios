import { requireStaff } from '@/lib/auth';
import { getMenu } from '@/lib/orders';
import { productCosts } from '@/lib/inventory';
import { can } from '@/lib/permissions';
import { MenuEditor } from '@/components/menu-editor';
import { PageTitle } from '@/components/ui';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const staff = await requireStaff('orders.take');
  const t = await getT();
  const menu = await getMenu(staff.businessId);
  const canEdit = can(staff.role, 'menu.edit');
  const canRecipe = can(staff.role, 'inventory.manage');
  const costs = canRecipe ? Object.fromEntries(await productCosts(staff.businessId)) : {};
  return (
    <div className="space-y-6">
      <PageTitle
        title={t('Carta')}
        text={
          canEdit
            ? t('La misma carta para todas las sedes. Cada categoría va a cocina o a barra; un producto puede ir a otra estación. Los cambios de precio quedan en la auditoría y no tocan lo ya pedido.')
            : t('Marca aquí lo que se acabó: los meseros ya no lo podrán pedir hasta que vuelva a haber.')
        }
      />
      <MenuEditor categories={menu.categories} products={menu.products} canEdit={canEdit} canRecipe={canRecipe} costs={costs} />
    </div>
  );
}
