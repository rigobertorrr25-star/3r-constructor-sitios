import { getBackground } from '@/lib/backgrounds';

export const dynamic = 'force-dynamic';

/** Foto de fondo de un restaurante. Con ?v= (versión) se guarda en caché un año: al cambiarla, cambia la dirección. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return new Response('No encontrado', { status: 404 });
  const bg = await getBackground(slug).catch(() => null);
  if (!bg) return new Response('No encontrado', { status: 404 });
  const versioned = new URL(request.url).searchParams.has('v');
  return new Response(new Uint8Array(bg.image), {
    headers: {
      'Content-Type': bg.mime,
      'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
