import { requireStaff } from '@/lib/auth';
import { invoicesCsv, listInvoices } from '@/lib/invoices';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Descarga las facturas del periodo para Excel (o para subirlas al proveedor). */
export async function GET(request: Request) {
  const staff = await requireStaff('invoices.manage');
  const url = new URL(request.url);
  const from = url.searchParams.get('desde') ?? '';
  const to = url.searchParams.get('hasta') ?? '';
  if (!DATE.test(from) || !DATE.test(to) || from > to) return new Response('Fechas no válidas', { status: 400 });
  const invoices = await listInvoices(staff, { from, to }, staff.timezone);
  return new Response(invoicesCsv(invoices.filter((i) => i.status !== 'void'), staff.timezone), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="facturas-${staff.businessSlug}-${from}-a-${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
