// Descarga del reporte de asistencia para abrir en Excel.
import { NextResponse, type NextRequest } from 'next/server';
import { canView, getViewer } from '@/lib/auth';
import { isLang, t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { isDay, recordsCsv } from '@/lib/report';
import { AppError, getBusiness, listRecords } from '@/lib/store';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(new URL('/entrar', request.url));
  const { id } = await context.params;
  const from = request.nextUrl.searchParams.get('from') ?? undefined;
  const to = request.nextUrl.searchParams.get('to') ?? undefined;
  if (!isDay(from) || !isDay(to)) return NextResponse.json({ message: 'Fechas inválidas' }, { status: 400 });

  // El idioma va en el enlace (el de la página desde donde se descargó).
  const asked = request.nextUrl.searchParams.get('lang');
  const lang = isLang(asked) ? asked : await getLang();
  const business = await getBusiness(id);
  if (!business || !canView(viewer, business.id)) return NextResponse.json({ message: 'No encontrado' }, { status: 404 });
  try {
    const records = await listRecords(business.id, from, to);
    return new NextResponse(recordsCsv(records, business.shifts, lang), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${t(lang, 'csvFile')}-${business.slug}-${from}-${to}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ message: error.message }, { status: 400 });
    throw error;
  }
}
