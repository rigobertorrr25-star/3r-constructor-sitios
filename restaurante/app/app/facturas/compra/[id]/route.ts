import { requireStaff } from '@/lib/auth';
import { getExpensePhoto } from '@/lib/finance';

export const dynamic = 'force-dynamic';

/** Foto de la factura de compra de un gasto: solo para quien registra gastos en ese negocio (no es pública). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('expenses.add');
  const { id } = await params;
  const photo = await getExpensePhoto(staff, id).catch(() => null);
  if (!photo) return new Response('No encontrado', { status: 404 });
  return new Response(new Uint8Array(photo.image), {
    headers: { 'Content-Type': photo.mime, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}
