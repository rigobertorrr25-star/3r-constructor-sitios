// La tablet de la entrada pregunta aquí por el QR vigente. El QR abre /marcar/{negocio}?c={código}
// en el celular del empleado; el código cambia cada 30 segundos.
import { NextResponse, type NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { getKiosk } from '@/lib/store';

export async function GET(request: NextRequest, context: { params: Promise<{ secret: string }> }) {
  const { secret } = await context.params;
  let kiosk;
  try {
    kiosk = await getKiosk(secret);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'No se pudo conectar con la base de datos' }, { status: 502 });
  }
  if (!kiosk) return NextResponse.json({ message: 'Enlace de tablet no válido' }, { status: 404 });

  const url = `${request.nextUrl.origin}/marcar/${encodeURIComponent(kiosk.slug)}?c=${encodeURIComponent(kiosk.code)}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000103', light: '#ffffff' } });
  return NextResponse.json({ name: kiosk.name, svg, expiresInMs: kiosk.expiresInMs }, { headers: { 'cache-control': 'no-store' } });
}
