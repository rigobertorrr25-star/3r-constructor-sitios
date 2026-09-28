// La tablet de la entrada pregunta aquí por el QR vigente. El QR abre /marcar/{negocio}?c={código}
// en el celular del empleado; el código cambia cada 30 segundos.
import { NextResponse, type NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { rawApi } from '@/lib/api';

type Kiosk = { name: string; slug: string; code: string; expiresInMs: number; windowMs: number };

export async function GET(request: NextRequest, context: { params: Promise<{ secret: string }> }) {
  const { secret } = await context.params;
  let res;
  try {
    res = await rawApi<Kiosk>(`/attendance/kiosk/${encodeURIComponent(secret)}`);
  } catch {
    return NextResponse.json({ message: 'No se pudo conectar con el servidor' }, { status: 502 });
  }
  if (!res.ok) return NextResponse.json({ message: 'Enlace de tablet no válido' }, { status: res.status === 404 ? 404 : 502 });

  const url = `${request.nextUrl.origin}/marcar/${encodeURIComponent(res.data.slug)}?c=${encodeURIComponent(res.data.code)}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000103', light: '#ffffff' } });
  return NextResponse.json(
    { name: res.data.name, svg, expiresInMs: res.data.expiresInMs },
    { headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } },
  );
}
