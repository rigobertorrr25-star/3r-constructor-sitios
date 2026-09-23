import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env: se usan las variables del entorno.
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Los límites son una primera propuesta y se ajustan según los costos reales.
const plans = [
  {
    name: 'Starter',
    priceCents: 1500,
    maxSites: 1,
    maxPages: 5,
    maxStorageMb: 500,
    customDomains: false,
    analytics: false,
    whiteLabel: false,
  },
  {
    name: 'Business',
    priceCents: 3000,
    maxSites: 5,
    maxPages: 25,
    maxStorageMb: 5120,
    customDomains: true,
    analytics: true,
    whiteLabel: false,
  },
  {
    name: 'Agency',
    priceCents: 5000,
    maxSites: 25,
    maxPages: 100,
    maxStorageMb: 20480,
    customDomains: true,
    analytics: true,
    whiteLabel: true,
  },
];

// Documento del editor: árbol JSON versionado (ver docs del formato en packages/types).
const heroSection = (heading: string, subheading: string, cta: string) => ({
  id: 'section-hero',
  type: 'hero',
  styles: { background: '#000103', paddingTop: 96, paddingBottom: 96 },
  components: [
    {
      id: 'heading-1',
      type: 'heading',
      content: heading,
      styles: {
        fontSize: { desktop: 52, tablet: 42, mobile: 34 },
        fontWeight: 700,
        textAlign: 'center',
        color: '#f2f6f8',
      },
    },
    {
      id: 'text-1',
      type: 'text',
      content: subheading,
      styles: { fontSize: { desktop: 19, tablet: 18, mobile: 16 }, textAlign: 'center', color: '#a5abb5' },
    },
    { id: 'button-1', type: 'button', content: cta, props: { href: '#contacto' }, styles: { textAlign: 'center' } },
  ],
});

const templates = [
  {
    name: 'En blanco',
    slug: 'blank',
    category: 'basic',
    content: { version: 1, sections: [] },
  },
  {
    name: 'Restaurante caribeño',
    slug: 'restaurant-caribbean',
    category: 'restaurant',
    content: {
      version: 1,
      sections: [heroSection('Sabor del Caribe', 'Cocina de la casa, ingredientes frescos y buen ambiente.', 'Reservar mesa')],
    },
  },
  {
    name: 'Portafolio',
    slug: 'portfolio',
    category: 'portfolio',
    content: {
      version: 1,
      sections: [heroSection('Hola, soy tu nombre', 'Diseño, desarrollo y fotografía.', 'Ver mi trabajo')],
    },
  },
];

// Paquetes de venta de ejemplo: precios y textos son provisionales y se editan desde /admin/paquetes.
// La mensualidad ($60.000, $120.000, $200.000 COP) es el hosting y mantenimiento opcional.
const packages = [
  {
    name: 'Página Esencial',
    slug: 'esencial',
    tagline: 'Para empezar con presencia en internet',
    description: 'Una página profesional, clara y lista para recibir clientes.',
    priceCents: 35000000,
    monthlyPriceCents: 6000000,
    currency: 'COP',
    pagesIncluded: 1,
    deliveryDays: 5,
    isFeatured: false,
    sortOrder: 1,
    features: [
      'Diseño a medida en una página',
      'Se ve bien en celular, tablet y computadora',
      'Botón de WhatsApp y datos de contacto',
      'Entrega en 5 días hábiles',
    ],
  },
  {
    name: 'Sitio para tu Negocio',
    slug: 'negocio',
    tagline: 'El más elegido por negocios locales',
    description: 'Un sitio completo con varias secciones para mostrar lo que haces.',
    priceCents: 65000000,
    monthlyPriceCents: 12000000,
    currency: 'COP',
    pagesIncluded: 5,
    deliveryDays: 10,
    isFeatured: true,
    sortOrder: 2,
    features: [
      'Hasta 5 páginas (inicio, servicios, galería, nosotros, contacto)',
      'Diseño a medida con tu marca',
      'Formulario de contacto y mapa de ubicación',
      'Posicionamiento básico en Google (SEO)',
      'Entrega en 10 días hábiles',
    ],
  },
  {
    name: 'Presencia Completa',
    slug: 'completa',
    tagline: 'Para destacar y crecer',
    description: 'Todo lo anterior, con más páginas, más cuidado y acompañamiento.',
    priceCents: 150000000,
    monthlyPriceCents: 20000000,
    currency: 'COP',
    pagesIncluded: 10,
    deliveryDays: 15,
    isFeatured: false,
    sortOrder: 3,
    features: [
      'Hasta 10 páginas',
      'Tu propio dominio conectado (.com)',
      'Galería, reseñas y redes sociales integradas',
      'SEO avanzado y velocidad optimizada',
      '2 rondas de cambios incluidas',
      'Entrega en 15 días hábiles',
    ],
  },
];

// Trabajos reales de Jhonny para el portafolio de la portada. PortfolioItem no tiene una columna
// única aparte del id, así que se crea solo si no existe ya un trabajo con esa misma dirección.
const portfolio = [
  {
    title: '3R Burgers',
    url: 'https://rigobertorrr25-star.github.io/3r-burgers/',
    category: 'Restaurante',
    description: 'Menú digital para una hamburguesería en Cartagena.',
    sortOrder: 1,
  },
  {
    title: 'Caprichos',
    url: 'https://rigobertorrr25-star.github.io/caprichos-tienda/',
    category: 'Tienda de ropa',
    description: 'Tienda de moda femenina en Cartagena.',
    sortOrder: 2,
  },
  {
    title: 'Azul Caribe Lounge',
    url: 'http://azulcaribelounge.com/',
    category: 'Restaurante',
    description: 'Menú digital para un lounge frente al mar.',
    sortOrder: 3,
  },
  {
    title: 'Fidelio Pastas',
    url: 'https://fidelio-pastas.vercel.app/',
    category: 'Restaurante',
    description: 'Menú digital para un restaurante de pastas.',
    sortOrder: 4,
  },
];

async function main() {
  for (const pkg of packages) {
    await prisma.package.upsert({ where: { slug: pkg.slug }, update: {}, create: pkg });
  }
  for (const plan of plans) {
    await prisma.plan.upsert({ where: { name: plan.name }, update: plan, create: plan });
  }
  for (const template of templates) {
    await prisma.template.upsert({
      where: { slug: template.slug },
      update: { name: template.name, category: template.category, content: template.content },
      create: template,
    });
  }
  for (const item of portfolio) {
    const exists = await prisma.portfolioItem.findFirst({ where: { url: item.url } });
    if (!exists) await prisma.portfolioItem.create({ data: item });
  }
  console.log(`Seed listo: ${packages.length} paquetes, ${plans.length} planes, ${templates.length} plantillas, ${portfolio.length} trabajos de portafolio.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
