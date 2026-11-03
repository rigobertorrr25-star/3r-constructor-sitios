// Dibujo del avatar de un empleado. Siempre el mismo para la misma dirección, así que se guarda en caché.
import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import { AVATAR_SEED } from '@/lib/avatar';

// Fondos suaves que combinan con el lila 3R.
const BACKGROUNDS = ['dfe3ff', 'e9dcff', 'ffdcef', 'd9f2e6', 'fff0cc', 'dceffd'];
// Solo caras amables y colores de pelo naturales.
const FACE = {
  eyebrows: ['variant03', 'variant04', 'variant05', 'variant06', 'variant07', 'variant08', 'variant09', 'variant10', 'variant11', 'variant12', 'variant13', 'variant14', 'variant15'],
  eyes: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05', 'variant06', 'variant07', 'variant08', 'variant09', 'variant10', 'variant11', 'variant12', 'variant15', 'variant16', 'variant17', 'variant18', 'variant23', 'variant24', 'variant25', 'variant26'],
  mouth: ['variant01', 'variant02', 'variant05', 'variant09', 'variant21', 'variant22', 'variant23', 'variant25', 'variant26', 'variant27', 'variant28', 'variant29', 'variant30'],
  hairColor: ['0e0e0e', '562306', '6a4e35', '796a45', 'ac6511', 'b9a05f'],
  glassesProbability: 10,
} as const;
// Peinados que se ven claramente de hombre o de mujer.
const MALE = {
  hair: ['short01', 'short02', 'short03', 'short04', 'short05', 'short07', 'short08', 'short09', 'short10', 'short11', 'short13', 'short14', 'short17', 'short18'],
  earringsProbability: 0,
  features: ['mustache', 'freckles', 'birthmark'],
  featuresProbability: 25,
} as const;
const FEMALE = {
  hair: ['long01', 'long02', 'long03', 'long04', 'long05', 'long06', 'long07', 'long08', 'long09', 'long11', 'long14', 'long15', 'long16', 'long17', 'long18', 'long19', 'long20', 'long22', 'long24', 'long26'],
  earringsProbability: 50,
  features: ['blush', 'freckles'],
  featuresProbability: 30,
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ seed: string }> }) {
  const { seed } = await params;
  const match = AVATAR_SEED.exec(seed);
  if (!match) return new Response('No encontrado', { status: 404 });
  const options = {
    seed: match[1],
    backgroundColor: BACKGROUNDS,
    backgroundType: ['solid' as const],
    ...FACE,
    ...(match[2]?.toLowerCase() === 'f' ? FEMALE : MALE),
  };
  // Los tipos de DiceBear piden listas modificables; las de arriba son de solo lectura.
  const svg = createAvatar(adventurer, JSON.parse(JSON.stringify(options))).toString();
  return new Response(svg, {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=31536000, immutable' },
  });
}
