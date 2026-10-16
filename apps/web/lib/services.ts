// Servicio aparte de las páginas: control de entrada y salida de empleados con QR. Se anuncia en la portada y
// en la cuenta del cliente; el sistema vive en otra dirección y los botones llevan a WhatsApp, no a la app.
export const ATTENDANCE_PRICE = '$90.000';
export const ATTENDANCE_SETUP = '$300.000';
// Instalación con descuento para quien también compra su página con nosotros.
export const ATTENDANCE_SETUP_WITH_PAGE = '$150.000';

/*
 * Servicios de 3R además de los paquetes de página (los paquetes viven en /admin/paquetes).
 * Precios en un solo lugar para cambiarlos fácil. Se fijaron el 16 oct 2026 mirando el mercado colombiano:
 * menús QR en apps desde $20.000–$80.000/mes; manejo de redes freelance $600.000–$2.500.000/mes; post suelto
 * desde ~$40.000 y flyer $200.000–$450.000; tienda virtual básica $1.500.000–$2.500.000; CRM en dólares, ~$50.000–$100.000 por
 * usuario al mes. 3R se ubica en la parte baja-media del rango: cliente pequeño, trato directo.
 */
export type ServiceKey = 'menu' | 'store' | 'social' | 'design' | 'domain';
export type Service = {
  key: ServiceKey;
  title: string;
  /** Para quién o qué problema resuelve, en una frase. */
  pitch: string;
  includes: string[];
  price: string;
  /** Lo que acompaña al precio: "pago único", "al mes"… */
  priceNote: string;
  extra?: string;
  whatsapp: string;
};

export const SERVICES: Service[] = [
  {
    key: 'menu',
    title: 'Menú digital con QR',
    pitch: 'Tu carta en el celular del cliente: escanea el QR de la mesa y ve tus platos con foto y precio.',
    includes: [
      'Diseño con tus colores, tu logo y fotos de tus platos',
      'Categorías, etiquetas («Más pedido», «Picante») y botón para pedir por WhatsApp',
      'Código QR listo para imprimir en mesas y vitrinas',
      'Si cambias un precio, lo actualizamos y el QR impreso sigue sirviendo',
    ],
    price: '$350.000',
    priceNote: 'pago único',
    extra: 'Cambios de platos y precios cuando quieras: $40.000 al mes (opcional).',
    whatsapp: 'Hola, quiero un menú digital con QR para mi negocio',
  },
  {
    key: 'store',
    title: 'Tienda en línea',
    pitch: 'Vende por internet sin depender de una plataforma en dólares: tu catálogo, tu carrito y tus pedidos.',
    includes: [
      'Catálogo con fotos, precios y opciones (tallas, colores, tamaños)',
      'Carrito, cupones de descuento y costo de domicilio',
      'El cliente pide en la página o por WhatsApp; tú ves cada pedido y su estado',
      'Cargamos tus primeros 50 productos',
    ],
    price: '$1.200.000',
    priceNote: 'pago único',
    extra: 'Plataforma, soporte y cambios: $90.000 al mes.',
    whatsapp: 'Hola, quiero una tienda en línea para mi negocio',
  },
  {
    key: 'social',
    title: 'Contenido para Instagram y Facebook',
    pitch: 'Tus redes al día cada mes, con piezas pensadas para tu negocio y no plantillas genéricas.',
    includes: [
      'Calendario del mes con lo que se publica cada día',
      '12 publicaciones (posts y carruseles) con diseño y texto listos',
      'Plan completo: además 4 reels con guion y 15 historias',
      'Lo dejamos programado en Meta Business Suite si quieres',
    ],
    price: '$590.000',
    priceNote: 'al mes',
    extra: 'Plan completo con reels e historias: $990.000 al mes.',
    whatsapp: 'Hola, quiero el plan de contenido para las redes de mi negocio',
  },
  {
    key: 'design',
    title: 'Flyers y piezas gráficas',
    pitch: 'Para una promoción, un evento o el lanzamiento de un producto, cuando lo necesitas y sin plan mensual.',
    includes: [
      'Post o historia para redes: $40.000',
      'Flyer o volante listo para imprimir (con sangrado): $150.000',
      'Paquete de 8 piezas para una campaña: $280.000',
      'Con tus colores y tu logo real',
    ],
    price: '$40.000',
    priceNote: 'desde, por pieza',
    whatsapp: 'Hola, necesito el diseño de un flyer o una pieza para mi negocio',
  },
  {
    key: 'domain',
    title: 'Dominio propio',
    pitch: 'Una dirección solo tuya, como tunegocio.com, que se ve seria en tus tarjetas, redes y WhatsApp.',
    includes: ['Te ayudamos a escoger un nombre disponible', 'Lo conectamos a tu página', 'Te avisamos 30 días antes de que se venza'],
    price: '$50.000',
    priceNote: 'al año',
    whatsapp: 'Hola, quiero un dominio propio para mi negocio',
  },
];

/*
 * La plataforma para empresas (los módulos de /empresa). Precio por empresa, no por usuario: un CRM o un
 * sistema de personal en el mercado cobra por cada persona y casi siempre en dólares.
 */
export type PlatformPlan = { key: string; title: string; pitch: string; modules: string[]; price: string; featured?: boolean; whatsapp: string };

export const PLATFORM_SETUP = '$300.000';

export const PLATFORM_PLANS: PlatformPlan[] = [
  {
    key: 'clientes',
    title: 'Clientes y ventas',
    pitch: 'Para no perder a nadie que te pidió precio y vender más a los que ya te compraron.',
    modules: [
      'CRM: cada cliente con su historial y en qué va (nuevo, cotización, ganado)',
      'Cotizaciones con enlace: tu cliente acepta o pide cambios desde el celular',
      'Correos de promoción a tus clientes, solo a quien aceptó recibirlos',
      'Encuestas de satisfacción y preguntas frecuentes para tus clientes',
      'Avisos cuando algo necesita tu atención',
    ],
    price: '$190.000',
    whatsapp: 'Hola, me interesa el plan Clientes y ventas de la plataforma para mi empresa',
  },
  {
    key: 'equipo',
    title: 'Tu equipo',
    pitch: 'Todo lo de tus empleados en un solo lugar, sin hojas de Excel ni papeles perdidos.',
    modules: [
      'Ficha de cada empleado: cargo, contrato, contacto de emergencia',
      'Permisos y vacaciones: el empleado pide, el jefe aprueba',
      'Documentos privados y certificados laborales en PDF con un clic',
      'Comunicados, calendario y cumpleaños del equipo',
      'Capacitaciones con evaluación y certificado',
      'Inventario y equipos entregados a cada persona',
    ],
    price: '$190.000',
    whatsapp: 'Hola, me interesa el plan Tu equipo de la plataforma para mi empresa',
  },
  {
    key: 'completo',
    title: 'Empresa completa',
    pitch: 'Los dos planes juntos, más tu tienda, tu página y la ayuda de la inteligencia artificial.',
    modules: [
      'Todo lo de Clientes y ventas y Tu equipo',
      'Tienda en línea y página web que tú mismo actualizas',
      'Visitas de tu página y revisión para salir en Google',
      'Automatizaciones: si entra un pedido grande, te avisa y crea la tarea',
      'Asistente con IA que responde con tus manuales, y textos para tus redes',
    ],
    price: '$390.000',
    featured: true,
    whatsapp: 'Hola, me interesa el plan Empresa completa de la plataforma',
  },
];
