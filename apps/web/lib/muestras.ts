// Muestras de venta: cómo se vería la página de un negocio que todavía no tiene. Se mandan por WhatsApp al dueño
// (3rpaginas.com/muestra/<slug>). Nombre, dirección, horario y calificación son los públicos de Google Maps;
// los productos son de ejemplo y no llevan precio. No se enlazan, no van en el sitemap y llevan noindex.
// Si un negocio pide que se quite, se borra de aquí (y su foto de public/muestras/negocios).

export type MuestraKind = 'pedidos' | 'turnos' | 'mesa';
export type MuestraFont = 'bebas' | 'playfair' | 'oswald' | 'sora';

export type Muestra = {
  slug: string;
  name: string;
  /** Qué es, en pocas palabras (sale arriba del nombre). */
  kind: MuestraKind;
  label: string;
  tagline: string;
  city: 'Cartagena' | 'Barranquilla';
  address: string;
  mapsUrl: string;
  /** WhatsApp del negocio (573001234567): a donde llegan los pedidos o turnos de la muestra. */
  whatsapp: string;
  rating: number;
  reviews: number;
  /** Horario de Google Maps, ya en español. */
  hours: string[];
  /** Foto de la fachada (de Google Maps) en /muestras/negocios. */
  photo?: string;
  theme: { bg: string; surface: string; text: string; muted: string; accent: string; onAccent: string; font: MuestraFont };
  sections: { title: string; items: { name: string; desc: string }[] }[];
};

const maps = (placeId: string) => `https://www.google.com/maps/place/?q=place_id:${placeId}`;

const COMBOS = { title: 'Para acompañar', items: [
  { name: 'Papas a la francesa', desc: 'Porción para uno o para compartir' },
  { name: 'Jugo natural', desc: 'De la fruta del día' },
  { name: 'Gaseosa', desc: 'Personal o de litro' },
] };

export const MUESTRAS: Muestra[] = [
  {
    slug: 'arepas-pues',
    name: 'Arepas Pues',
    kind: 'pedidos',
    label: 'Arepas y comidas rápidas',
    tagline: 'Arepas de la tarde a la madrugada en Bocagrande.',
    city: 'Cartagena',
    address: 'Cra. 2 #4-86, Bocagrande, Cartagena',
    mapsUrl: maps('ChIJgXC9oz0v9o4RKGorKmFPz18'),
    whatsapp: '573206206270',
    rating: 4.1,
    reviews: 1538,
    hours: ['Todos los días · 4:00 p. m. a 6:00 a. m.'],
    photo: '/muestras/negocios/arepas-pues.jpg',
    theme: { bg: '#b3121f', surface: '#8f0e18', text: '#fff7e6', muted: '#ffd9a8', accent: '#ffc928', onAccent: '#3a0a0e', font: 'bebas' },
    sections: [
      { title: 'Arepas', items: [
        { name: 'Arepa de la casa', desc: 'Rellena con lo que más te piden' },
        { name: 'Arepa con todo', desc: 'Carne, pollo, chorizo, queso y salsas' },
        { name: 'Arepa de queso', desc: 'Doble queso, recién asada' },
        { name: 'Arepa de huevo', desc: 'La de la costa, crocante por fuera' },
      ] },
      COMBOS,
    ],
  },
  {
    slug: 'mi-palacio-de-las-papas',
    name: 'Mi Palacio de las Papas',
    kind: 'pedidos',
    label: 'Comidas rápidas',
    tagline: 'Papas, picadas y comidas rápidas en El Bosque, desde temprano hasta la noche.',
    city: 'Cartagena',
    address: 'Tv. 45 #21 A 02, El Bosque, Cartagena',
    mapsUrl: maps('ChIJv1wtyYwl9o4R0-M8T8yHy2A'),
    whatsapp: '573205828444',
    rating: 4.5,
    reviews: 1082,
    hours: ['Lunes a sábado · 5:00 a. m. a 2:00 a. m.', 'Domingo · 4:30 a. m. a 2:00 a. m.'],
    photo: '/muestras/negocios/mi-palacio-de-las-papas.jpg',
    theme: { bg: '#1a1a1a', surface: '#262626', text: '#ffffff', muted: '#c9c9c9', accent: '#e8202a', onAccent: '#ffffff', font: 'bebas' },
    sections: [
      { title: 'Papas', items: [
        { name: 'Salchipapa', desc: 'Papa a la francesa, salchicha y salsas' },
        { name: 'Papa rellena', desc: 'Con carne y huevo' },
        { name: 'Picada para compartir', desc: 'Papa, carnes, chorizo y butifarra' },
      ] },
      { title: 'Más del palacio', items: [
        { name: 'Perro caliente', desc: 'Con papita triturada y queso' },
        { name: 'Hamburguesa', desc: 'Carne de la casa y papas' },
        { name: 'Jugo natural', desc: 'De la fruta del día' },
      ] },
    ],
  },
  {
    slug: 'joche-burger',
    name: 'Joche Burger',
    kind: 'pedidos',
    label: 'Hamburguesas y comidas rápidas',
    tagline: 'Hamburguesas en La Heroica, de 5 de la tarde a 3 de la mañana.',
    city: 'Cartagena',
    address: 'Tv. 65, La Heroica, Cartagena',
    mapsUrl: maps('ChIJ4VDFoNgl9o4RGnhAr68CnG0'),
    whatsapp: '573216118549',
    rating: 4.1,
    reviews: 467,
    hours: ['Todos los días · 5:00 p. m. a 3:00 a. m.'],
    photo: '/muestras/negocios/joche-burger.jpg',
    theme: { bg: '#15110d', surface: '#231c15', text: '#fff4e8', muted: '#d8c3ac', accent: '#ff7a00', onAccent: '#1a0d00', font: 'bebas' },
    sections: [
      { title: 'Hamburguesas', items: [
        { name: 'Joche clásica', desc: 'Carne a la plancha, queso, lechuga y tomate' },
        { name: 'Doble carne', desc: 'Dos carnes, doble queso y tocineta' },
        { name: 'Hamburguesa de pollo', desc: 'Pechuga apanada y salsa de la casa' },
      ] },
      { title: 'Perros y más', items: [
        { name: 'Perro especial', desc: 'Salchicha americana, queso y papita' },
        { name: 'Salchipapa', desc: 'Para uno o para compartir' },
        { name: 'Gaseosa', desc: 'Personal o de litro' },
      ] },
    ],
  },
  {
    slug: 'barber-prestige',
    name: 'Barber Prestige',
    kind: 'turnos',
    label: 'Barbería y peluquería',
    tagline: 'Pide tu turno desde el celular y llega a la hora, sin hacer fila.',
    city: 'Cartagena',
    address: 'Edificio Neptuno, Av. 3 #5-187, local 2, Bocagrande, Cartagena',
    mapsUrl: maps('ChIJ7xuUCR0l9o4RYuCK1Q3Uexg'),
    whatsapp: '573043675566',
    rating: 4.9,
    reviews: 803,
    hours: ['Todos los días · 6:00 a. m. a 10:30 p. m.'],
    photo: '/muestras/negocios/barber-prestige.jpg',
    theme: { bg: '#0d0d0d', surface: '#1a1712', text: '#f5f1e8', muted: '#b9ad97', accent: '#c9a24a', onAccent: '#0d0d0d', font: 'oswald' },
    sections: [
      { title: 'Servicios', items: [
        { name: 'Corte', desc: 'Con lavado y peinado' },
        { name: 'Corte y barba', desc: 'El combo completo' },
        { name: 'Barba', desc: 'Perfilado con toalla caliente' },
        { name: 'Cejas', desc: 'Con cuchilla o hilo' },
        { name: 'Corte para niño', desc: 'Hasta 12 años' },
      ] },
    ],
  },
  {
    slug: 'satio-cafe',
    name: 'Satio Café',
    kind: 'pedidos',
    label: 'Café y bar · Getsemaní',
    tagline: 'Café, desayunos y algo para picar en Getsemaní.',
    city: 'Cartagena',
    address: 'Cl. 30 #10-81, Getsemaní, Cartagena',
    mapsUrl: maps('ChIJfQ3U5_Ev9o4RXZbQfUhN60c'),
    whatsapp: '573159384400',
    rating: 4.8,
    reviews: 507,
    hours: ['Lunes a sábado · 7:00 a. m. a 5:00 p. m.', 'Domingo · 7:30 a. m. a 5:00 p. m.'],
    theme: { bg: '#1f3a2e', surface: '#284a3b', text: '#f4f1ea', muted: '#c6d3c9', accent: '#e9b872', onAccent: '#1f2a22', font: 'playfair' },
    sections: [
      { title: 'Café', items: [
        { name: 'Espresso', desc: 'Sencillo o doble' },
        { name: 'Capuchino', desc: 'Con leche texturizada' },
        { name: 'Café frío', desc: 'Para el calor de Cartagena' },
      ] },
      { title: 'Para comer', items: [
        { name: 'Desayuno de la casa', desc: 'Huevos, pan, fruta y café' },
        { name: 'Sándwich', desc: 'En pan artesanal' },
        { name: 'Postre del día', desc: 'Pregunta cuál hay hoy' },
      ] },
    ],
  },
  {
    slug: 'lagme',
    name: 'LAGME Restaurant',
    kind: 'mesa',
    label: 'Restaurante',
    tagline: 'Reserva tu mesa en segundos y mira la carta antes de llegar.',
    city: 'Cartagena',
    address: 'Edificio North Sea, Cra. 1 #46b-06, Cartagena',
    mapsUrl: maps('ChIJAexS4P4v9o4RQQb46-B-OGE'),
    whatsapp: '573053395409',
    rating: 4.9,
    reviews: 382,
    hours: ['Lunes · 12:00 m. a 8:00 p. m.', 'Martes a viernes · 12:00 m. a 10:00 p. m.', 'Sábado · 12:00 m. a 3:00 p. m.', 'Domingo · 12:00 m. a 10:00 p. m.'],
    theme: { bg: '#0f1720', surface: '#17222e', text: '#f2f4f6', muted: '#a9b6c3', accent: '#d9b48f', onAccent: '#14100c', font: 'playfair' },
    sections: [
      { title: 'Entradas', items: [
        { name: 'Ceviche', desc: 'Pescado fresco, limón y cebolla morada' },
        { name: 'Patacones con hogao', desc: 'Para compartir' },
      ] },
      { title: 'Platos fuertes', items: [
        { name: 'Pescado del día', desc: 'Con arroz de coco y patacón' },
        { name: 'Lomo a la plancha', desc: 'Con papas y ensalada' },
        { name: 'Pasta de la casa', desc: 'Pregunta la de hoy' },
      ] },
      { title: 'Postres', items: [{ name: 'Postre de la casa', desc: 'Para cerrar' }] },
    ],
  },
  {
    slug: 'samue-in',
    name: 'Samue In',
    kind: 'pedidos',
    label: 'Comidas rápidas · Riomar',
    tagline: 'Comidas rápidas en Riomar: pide por WhatsApp y te lo tenemos listo.',
    city: 'Barranquilla',
    address: 'Cra. 52 #84-126, Riomar, Barranquilla',
    mapsUrl: maps('ChIJt5MvJK8t9I4RneObKvBprIA'),
    whatsapp: '573004382246',
    rating: 4.4,
    reviews: 1609,
    hours: [],
    theme: { bg: '#0e2a47', surface: '#143559', text: '#ffffff', muted: '#bcd0e6', accent: '#ffd23f', onAccent: '#0e2a47', font: 'bebas' },
    sections: [
      { title: 'Lo más pedido', items: [
        { name: 'Hamburguesa', desc: 'Carne de la casa, queso y papas' },
        { name: 'Perro caliente', desc: 'Con todo' },
        { name: 'Salchipapa', desc: 'Para uno o para compartir' },
        { name: 'Picada', desc: 'Carnes, papa y chorizo' },
      ] },
      COMBOS,
    ],
  },
  {
    slug: 'kaliche-pizza-bar',
    name: 'Kaliche Pizza Bar 82',
    kind: 'pedidos',
    label: 'Pizza y bar',
    tagline: 'Pizza, música y algo de tomar en la 82.',
    city: 'Barranquilla',
    address: 'Cra. 43b #82-24, Barranquilla',
    mapsUrl: maps('ChIJLyQvrgct9I4R0YoqzGCEMew'),
    whatsapp: '573006549232',
    rating: 4.4,
    reviews: 761,
    hours: ['Abierto las 24 horas'],
    photo: '/muestras/negocios/kaliche-pizza-bar.jpg',
    theme: { bg: '#120b24', surface: '#1d1338', text: '#f7f2ff', muted: '#c8b8ec', accent: '#ff4fa3', onAccent: '#1a0612', font: 'bebas' },
    sections: [
      { title: 'Pizzas', items: [
        { name: 'Pizza de la casa', desc: 'Personal, mediana o familiar' },
        { name: 'Hawaiana', desc: 'Jamón y piña' },
        { name: 'Pepperoni', desc: 'Con extra queso' },
      ] },
      { title: 'Para tomar', items: [
        { name: 'Cerveza', desc: 'Nacional o importada' },
        { name: 'Cóctel de la casa', desc: 'Pregunta el de hoy' },
        { name: 'Limonada de coco', desc: 'Bien fría' },
      ] },
    ],
  },
  {
    slug: 'nonna-rosa',
    name: 'Nonna Rosa',
    kind: 'mesa',
    label: 'Restaurante italiano',
    tagline: 'Cocina italiana en Barranquilla. Mira la carta y reserva tu mesa desde el celular.',
    city: 'Barranquilla',
    address: 'Cra. 53 #79-211, Barranquilla',
    mapsUrl: maps('ChIJj1jctaYt9I4RkCspWp3rOW0'),
    whatsapp: '573128276076',
    rating: 4.6,
    reviews: 595,
    hours: ['Lunes a sábado · 12:00 m. a 9:30 p. m.', 'Domingo · 12:00 m. a 9:00 p. m.'],
    photo: '/muestras/negocios/nonna-rosa.jpg',
    theme: { bg: '#ffffff', surface: '#eef3f8', text: '#13243b', muted: '#4c5e75', accent: '#c62f2f', onAccent: '#ffffff', font: 'playfair' },
    sections: [
      { title: 'Pastas', items: [
        { name: 'Lasaña de la nonna', desc: 'Carne, bechamel y queso gratinado' },
        { name: 'Spaghetti a la boloñesa', desc: 'Salsa de tomate y carne' },
        { name: 'Fettuccine Alfredo', desc: 'Crema y parmesano' },
      ] },
      { title: 'Pizzas', items: [
        { name: 'Margarita', desc: 'Tomate, mozzarella y albahaca' },
        { name: 'Pizza de la casa', desc: 'Pregunta la de hoy' },
      ] },
      { title: 'Postres', items: [{ name: 'Tiramisú', desc: 'Café y mascarpone' }] },
    ],
  },
  {
    slug: 'barbudos',
    name: 'Barbudos Barbershop',
    kind: 'turnos',
    label: 'Barber shop',
    tagline: 'Escoge el servicio, el día y la hora. Te confirmamos por WhatsApp.',
    city: 'Barranquilla',
    address: 'Cl. 72 #62-27, Barranquilla',
    mapsUrl: maps('ChIJE22ri5wt9I4RYl5YTA1CS90'),
    whatsapp: '573007354803',
    rating: 4.8,
    reviews: 254,
    hours: ['Lunes a viernes · 10:00 a. m. a 8:00 p. m.', 'Sábado · 9:00 a. m. a 8:00 p. m.', 'Domingo · 9:00 a. m. a 5:00 p. m.'],
    photo: '/muestras/negocios/barbudos.jpg',
    theme: { bg: '#ffffff', surface: '#f1f1f1', text: '#111111', muted: '#55575c', accent: '#111111', onAccent: '#ffffff', font: 'oswald' },
    sections: [
      { title: 'Servicios', items: [
        { name: 'Corte', desc: 'Clásico o con degradado' },
        { name: 'Corte y barba', desc: 'El combo completo' },
        { name: 'Arreglo de barba', desc: 'Perfilado y toalla caliente' },
        { name: 'Cejas', desc: 'Con cuchilla' },
      ] },
    ],
  },
];

export const getMuestra = (slug: string) => MUESTRAS.find((m) => m.slug === slug);
