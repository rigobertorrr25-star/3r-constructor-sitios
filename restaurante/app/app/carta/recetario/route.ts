// Recetario en PDF con la foto de cada plato (9 nov 2026, pedido de Rigoberto). /app/carta/recetario
import { getStaff } from '@/lib/auth';
import { todayIn } from '@/lib/finance';
import { longDate } from '@/lib/day-report';
import { can } from '@/lib/permissions';
import { recipeBookData, recipeBookPdf } from '@/lib/recipe-book';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const staff = await getStaff();
  if (!staff) return new Response('Entra al sistema para descargar el recetario.', { status: 401 });
  if (!can(staff.role, 'menu.edit') && !can(staff.role, 'inventory.view')) return new Response('Tu rol no puede ver las recetas.', { status: 403 });
  const dishes = await recipeBookData(staff);
  const today = todayIn(staff.timezone);
  // Los costos solo para dueño y administrador (los mismos que editan la carta).
  const pdf = await recipeBookPdf(dishes, { business: staff.businessName, showCosts: can(staff.role, 'menu.edit'), date: longDate(today) });
  return new Response(Buffer.from(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="recetario-${today}.pdf"`, 'Cache-Control': 'no-store' },
  });
}
