import { getProductPhoto } from '@/lib/product-photos';

export const dynamic = 'force-dynamic';

/** Foto de un producto de la carta. Con ?v= (versión) se guarda en caché un año: al cambiarla, cambia la dirección. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await getProductPhoto(id).catch(() => null);
  if (!photo) return new Response('No encontrado', { status: 404 });
  const versioned = new URL(request.url).searchParams.has('v');
  return new Response(new Uint8Array(photo.image), {
    headers: {
      'Content-Type': photo.mime,
      'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
