import { withBase } from '@/lib/assets';

export type Category =
  | 'Vestidos'
  | 'Bodys'
  | 'Corsets'
  | 'Camisetas'
  | 'Tops'
  | 'Faldas'
  | 'Jeans'
  | 'Shorts';

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: Category;
  price: number; // COP
  images: string[]; // paths relative to /products/
  description: string;
}

export const CATEGORIES: Category[] = [
  'Vestidos',
  'Bodys',
  'Corsets',
  'Camisetas',
  'Tops',
  'Faldas',
  'Jeans',
  'Shorts',
];

// Categories mentioned in the brand story that don't have stock/photos yet.
export const COMING_SOON_CATEGORIES = ['Bolsos', 'Calzado', 'Ropa de playa'];

const RAW_PRODUCTS: Product[] = [
  {
    id: 'vestido-rojo-pasion',
    slug: 'vestido-rojo-pasion',
    name: 'Vestido Rojo Pasión',
    category: 'Vestidos',
    price: 55000,
    images: ['/products/vestido-rojo-pasion-1.jpg', '/products/vestido-rojo-pasion-2.jpg'],
    description:
      'Vestido ajustado en rojo intenso, escote profundo y silueta que abraza tu figura. Para esa noche en la que quieres ser el centro de todas las miradas.',
  },
  {
    id: 'body-blanco-ajustado',
    slug: 'body-blanco-ajustado',
    name: 'Body Blanco Ajustado',
    category: 'Bodys',
    price: 60000,
    images: ['/products/body-blanco-ajustado.jpg'],
    description:
      'Body blanco de tela compresiva que realza tu cintura sin sacrificar comodidad. Ideal para combinar con falda o jean.',
  },
  {
    id: 'body-blanco-clasico',
    slug: 'body-blanco-clasico',
    name: 'Body Blanco Clásico',
    category: 'Bodys',
    price: 55000,
    images: ['/products/body-blanco-clasico.jpg'],
    description:
      'Body blanco básico y versátil, ese infaltable que combina con todo y nunca pasa de moda.',
  },
  {
    id: 'body-blanco-strappy',
    slug: 'body-blanco-strappy',
    name: 'Body Blanco Strappy',
    category: 'Bodys',
    price: 55000,
    images: ['/products/body-blanco-strappy.jpg'],
    description:
      'Body de tiras finas y escote en corazón. Delicado, femenino y perfecto para looks de día o de noche.',
  },
  {
    id: 'body-blanco-romance',
    slug: 'body-blanco-romance',
    name: 'Body Blanco Romance',
    category: 'Bodys',
    price: 55000,
    images: ['/products/body-blanco-romance.jpg'],
    description:
      'Body blanco de cuello alto para un look limpio y sofisticado que se luce solo o en capas.',
  },
  {
    id: 'body-blanco-tirantes',
    slug: 'body-blanco-tirantes',
    name: 'Body Blanco Tirantes',
    category: 'Bodys',
    price: 60000,
    images: ['/products/body-blanco-tirantes.jpg'],
    description:
      'Body de tirantes con acabado compresivo que moldea tu figura y te da esa seguridad que buscas.',
  },
  {
    id: 'body-blanco-espalda-abierta',
    slug: 'body-blanco-espalda-abierta',
    name: 'Body Blanco Espalda Abierta',
    category: 'Bodys',
    price: 60000,
    images: ['/products/body-blanco-espalda-abierta.jpg'],
    description:
      'Body de manga larga con espalda descubierta. Un básico con actitud para looks urbanos.',
  },
  {
    id: 'body-blanco-playero',
    slug: 'body-blanco-playero',
    name: 'Body Blanco Playero',
    category: 'Bodys',
    price: 60000,
    images: ['/products/body-blanco-playero.jpg'],
    description: 'Body blanco fresco y liviano, tu aliado perfecto para los días de playa en Cartagena.',
  },
  {
    id: 'body-rojo-pasion',
    slug: 'body-rojo-pasion',
    name: 'Body Rojo Pasión',
    category: 'Bodys',
    price: 60000,
    images: ['/products/body-rojo-pasion.jpg'],
    description: 'Body rojo de cuello alto con espalda abierta. Atrevido, elegante y hecho para brillar.',
  },
  {
    id: 'corset-blanco-floral',
    slug: 'corset-blanco-floral',
    name: 'Corset Blanco Floral',
    category: 'Corsets',
    price: 60000,
    images: ['/products/corset-blanco-floral.jpg'],
    description:
      'Corset blanco de encaje floral con costuras marcadas. Romántico y con ese toque vintage que enamora.',
  },
  {
    id: 'corset-rojo-pasion',
    slug: 'corset-rojo-pasion',
    name: 'Corset Rojo Pasión',
    category: 'Corsets',
    price: 60000,
    images: ['/products/corset-rojo-pasion.jpg'],
    description: 'Corset rojo de encaje con amarrado frontal. Sensual, atrevido y hecho para resaltar tu figura.',
  },
  {
    id: 'corset-negro-romantico',
    slug: 'corset-negro-romantico',
    name: 'Corset Negro Romántico',
    category: 'Corsets',
    price: 60000,
    images: ['/products/corset-negro-romantico.jpg'],
    description: 'Corset negro de encaje con amarrado lateral. El capricho perfecto para una noche especial.',
  },
  {
    id: 'corset-blanco-elegante',
    slug: 'corset-blanco-elegante',
    name: 'Corset Blanco Elegante',
    category: 'Corsets',
    price: 60000,
    images: ['/products/corset-blanco-elegante.jpg'],
    description:
      'Corset blanco de encaje con cinta ajustable al frente. Elegancia y sensualidad en una sola pieza.',
  },
  {
    id: 'falda-celeste-cruzada',
    slug: 'falda-celeste-cruzada',
    name: 'Falda Celeste Cruzada',
    category: 'Faldas',
    price: 65000,
    images: ['/products/falda-celeste-cruzada.jpg'],
    description:
      'Falda mini cruzada en celeste con hebilla dorada. Fresca, coqueta y perfecta para el clima de Cartagena.',
  },
  {
    id: 'camiseta-gatito-rosa',
    slug: 'camiseta-gatito-rosa',
    name: 'Camiseta Gatito Rosa',
    category: 'Camisetas',
    price: 50000,
    images: ['/products/camiseta-gatito-rosa.jpg'],
    description: 'Camiseta crop oversized con estampado de gatito. Cómoda, juvenil y llena de personalidad.',
  },
  {
    id: 'camiseta-racing-jeff-gordon',
    slug: 'camiseta-racing-jeff-gordon',
    name: 'Camiseta Racing Vintage',
    category: 'Camisetas',
    price: 50000,
    images: ['/products/camiseta-racing-jeff-gordon.jpg'],
    description: 'Camiseta crop estilo racing vintage. La tendencia retro que no puede faltar en tu clóset.',
  },
  {
    id: 'camiseta-tupac-vintage',
    slug: 'camiseta-tupac-vintage',
    name: 'Camiseta Vintage',
    category: 'Camisetas',
    price: 50000,
    images: ['/products/camiseta-tupac-vintage.jpg'],
    description: 'Camiseta crop estampada vintage. Un básico con actitud para tus looks casuales.',
  },
  {
    id: 'camiseta-michael-jordan',
    slug: 'camiseta-michael-jordan',
    name: 'Camiseta Retro Deportiva',
    category: 'Camisetas',
    price: 50000,
    images: ['/products/camiseta-michael-jordan.jpg'],
    description: 'Camiseta oversized con estampado deportivo retro. Comodidad y estilo urbano en una sola prenda.',
  },
  {
    id: 'camiseta-racing-rosa',
    slug: 'camiseta-racing-rosa',
    name: 'Camiseta Racing Rosa',
    category: 'Camisetas',
    price: 50000,
    images: ['/products/camiseta-racing-rosa.jpg'],
    description: 'Camiseta crop estilo racing en tonos rosa y negro. Para un look deportivo con mucha actitud.',
  },
  {
    id: 'top-negro-escote',
    slug: 'top-negro-escote',
    name: 'Top Negro Escote',
    category: 'Tops',
    price: 40000,
    images: ['/products/top-negro-escote.jpg'],
    description: 'Top negro con escote profundo y anudado frontal. Sensual y versátil, ideal para salir de noche.',
  },
  {
    id: 'top-blanco-pedreria',
    slug: 'top-blanco-pedreria',
    name: 'Top Blanco Pedrería',
    category: 'Tops',
    price: 40000,
    images: ['/products/top-blanco-pedreria.jpg'],
    description: 'Top blanco con aplicaciones de pedrería brillante. El toque de brillo que todo look necesita.',
  },
  {
    id: 'top-rosa-asimetrico',
    slug: 'top-rosa-asimetrico',
    name: 'Top Rosa Asimétrico',
    category: 'Tops',
    price: 40000,
    images: ['/products/top-rosa-asimetrico.jpg'],
    description: 'Top rosa asimétrico de un solo hombro. Delicado, diferente y con mucha actitud.',
  },
  {
    id: 'top-rojo-halter',
    slug: 'top-rojo-halter',
    name: 'Top Rojo Halter',
    category: 'Tops',
    price: 40000,
    images: ['/products/top-rojo-halter.jpg'],
    description: 'Top rojo estilo halter con drapeado. Elegante y sensual para esa ocasión especial.',
  },
  {
    id: 'top-rojo-manga-larga',
    slug: 'top-rojo-manga-larga',
    name: 'Top Rojo Manga Larga',
    category: 'Tops',
    price: 40000,
    images: ['/products/top-rojo-manga-larga.jpg'],
    description:
      'Top rojo de manga larga en tela semitransparente. Un básico atrevido para combinar con jean o falda.',
  },
  {
    id: 'jean-oxford-wide-leg',
    slug: 'jean-oxford-wide-leg',
    name: 'Jean Oxford Wide Leg',
    category: 'Jeans',
    price: 90000,
    images: ['/products/jean-oxford-wide-leg.jpg'],
    description: 'Jean oxford wide leg con detalles desgastados. Comodidad y tendencia en una sola prenda.',
  },
  {
    id: 'set-deportivo-adidas',
    slug: 'set-deportivo-adidas',
    name: 'Set Deportivo Top + Short',
    category: 'Shorts',
    price: 60000,
    images: ['/products/set-deportivo-adidas.jpg'],
    description: 'Set deportivo de top y short a conjunto. Cómodo, fresco y perfecto para tu día a día activo.',
  },
];

export const PRODUCTS: Product[] = RAW_PRODUCTS.map((p) => ({
  ...p,
  images: p.images.map(withBase),
}));

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: Category): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  return PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, limit);
}
