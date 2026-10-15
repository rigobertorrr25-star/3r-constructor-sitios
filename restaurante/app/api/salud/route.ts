// Para saber si hay conexión con el servidor (lo consulta el aviso de "sin conexión"). No toca la base.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
