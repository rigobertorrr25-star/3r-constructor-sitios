// Dibujo del avatar de un empleado. Siempre el mismo para la misma dirección, así que se guarda en caché.
import { createAvatar } from '@dicebear/core';
import { notionists } from '@dicebear/collection';
import { AVATAR_SEED } from '@/lib/avatar';

// Fondos suaves que combinan con el lila 3R.
const BACKGROUNDS = ['dfe3ff', 'e9dcff', 'ffdcef', 'd9f2e6', 'fff0cc', 'dceffd'];

export async function GET(_request: Request, { params }: { params: Promise<{ seed: string }> }) {
  const { seed } = await params;
  if (!AVATAR_SEED.test(seed)) return new Response('No encontrado', { status: 404 });
  const svg = createAvatar(notionists, { seed, backgroundColor: BACKGROUNDS, backgroundType: ['solid'] }).toString();
  return new Response(svg, {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=31536000, immutable' },
  });
}
