// Descargar el cierre completo de un día en Excel (5 nov 2026). /app/caja/dia/excel?fecha=AAAA-MM-DD (sin fecha, hoy).
import { getStaff } from '@/lib/auth';
import { dayReport } from '@/lib/day-report';
import { dayReportXlsx } from '@/lib/day-report-xlsx';
import { todayIn } from '@/lib/finance';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const staff = await getStaff();
  if (!staff) return new Response('Entra al sistema para descargar el cierre.', { status: 401 });
  if (!can(staff.role, 'cash.operate')) return new Response('Tu rol no puede descargar el cierre.', { status: 403 });
  const asked = new URL(request.url).searchParams.get('fecha') ?? '';
  const today = todayIn(staff.timezone);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  const report = await dayReport(staff, date);
  if (!report) return new Response(`El ${date} no hubo caja.`, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const file = await dayReportXlsx(report);
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="cierre-${date}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
