// Descarga del reporte de asistencia para abrir en Excel.
import { NextResponse, type NextRequest } from 'next/server';
import { authedApi } from '@/lib/api';
import { isDay, recordsCsv, type AttendanceBusiness, type AttendanceRecord } from '@/lib/attendance';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const from = request.nextUrl.searchParams.get('from') ?? undefined;
  const to = request.nextUrl.searchParams.get('to') ?? undefined;
  if (!isDay(from) || !isDay(to)) return NextResponse.json({ message: 'Fechas inválidas' }, { status: 400 });

  const business = await authedApi<AttendanceBusiness>(`/admin/attendance/${encodeURIComponent(id)}`);
  if (!business.ok) return NextResponse.json({ message: 'No encontrado' }, { status: business.status });
  const records = await authedApi<AttendanceRecord[]>(`/admin/attendance/${encodeURIComponent(id)}/records?from=${from}&to=${to}`);
  if (!records.ok) return NextResponse.json({ message: 'No se pudo generar el reporte' }, { status: records.status });

  const filename = `asistencia-${business.data.slug}-${from}-a-${to}.csv`;
  return new NextResponse(recordsCsv(records.data), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
