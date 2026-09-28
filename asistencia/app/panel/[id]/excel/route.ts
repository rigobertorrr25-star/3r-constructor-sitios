// Descarga del reporte de asistencia para abrir en Excel.
import { NextResponse, type NextRequest } from 'next/server';
import { isLoggedIn } from '@/lib/auth';
import { isDay, recordsCsv } from '@/lib/report';
import { AppError, getBusiness, listRecords } from '@/lib/store';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isLoggedIn())) return NextResponse.redirect(new URL('/entrar', request.url));
  const { id } = await context.params;
  const from = request.nextUrl.searchParams.get('from') ?? undefined;
  const to = request.nextUrl.searchParams.get('to') ?? undefined;
  if (!isDay(from) || !isDay(to)) return NextResponse.json({ message: 'Fechas inválidas' }, { status: 400 });

  const business = await getBusiness(id);
  if (!business) return NextResponse.json({ message: 'No encontrado' }, { status: 404 });
  try {
    const records = await listRecords(business.id, from, to);
    return new NextResponse(recordsCsv(records), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="asistencia-${business.slug}-${from}-a-${to}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ message: error.message }, { status: 400 });
    throw error;
  }
}
