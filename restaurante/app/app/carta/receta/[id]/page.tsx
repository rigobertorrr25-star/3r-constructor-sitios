import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { getRecipe, listItems } from '@/lib/inventory';
import { getMenu } from '@/lib/orders';
import { RecipeEditor } from '@/components/recipe-editor';
import { PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('inventory.manage');
  const { id } = await params;
  const [menu, recipe, items] = await Promise.all([getMenu(staff.businessId), getRecipe(staff, id), listItems(staff, { activeOnly: true })]);
  const product = menu.products.find((p) => p.id === id);
  if (!product) notFound();
  return (
    <div className="space-y-6">
      <Link href="/app/carta" className="text-[14px] text-muted-foreground hover:text-foreground">
        ← Carta
      </Link>
      <PageTitle title={`Receta: ${product.name}`} text="Lo que gasta una unidad vendida. Cada vez que se envíe a cocina o barra, esto se descuenta del inventario." />
      <RecipeEditor
        productId={product.id}
        price={product.price}
        initial={recipe.map((r) => ({ itemId: r.itemId, quantity: String(r.quantity) }))}
        items={items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, unitCost: i.unitCost, bottleSize: i.bottleSize }))}
      />
    </div>
  );
}
