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
 * usuario al mes; tarjetas de sellos en apps (en dólares) ~$66.000–$140.000/mes. 3R se ubica en la parte baja-media del rango: cliente pequeño, trato directo.
 * Chatbot, página con video, manual de marca y perfil de Google: casi no hay precios publicados en pesos; se fijaron
 * por criterio, en línea con los demás (los chatbots con IA en dólares cobran plataforma + implementación + Meta aparte).
 * El orden es el de la portada: los 2 primeros van anchos.
 */
export type ServiceKey = 'chatbot' | 'loyalty' | 'menu' | 'restaurant' | 'store' | 'video' | 'social' | 'design' | 'brand' | 'google' | 'domain';
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
  /** Página con más detalle, si la hay. */
  more?: { href: string; label: string };
};

export const SERVICES: Service[] = [
  {
    key: 'chatbot',
    title: 'Chatbot de WhatsApp con IA',
    pitch: 'Tu WhatsApp contesta al momento, de día y de noche, las preguntas de siempre, y te pasa a ti lo que necesita una persona.',
    includes: [
      'Responde horarios, dirección, precios, domicilios y medios de pago con la información que tú le das',
      'Contesta en el idioma del cliente: español, inglés y más',
      'Si piden un pedido, una reserva o hablar con alguien, avisa a tu equipo y se calla',
      'Bandeja para todo tu equipo y cada cliente queda guardado en tu lista de clientes',
    ],
    price: '$149.000',
    priceNote: 'al mes',
    extra: 'Instalación y conexión de tu número con WhatsApp Business: $250.000. Si Meta cobra por los mensajes, eso va aparte.',
    whatsapp: 'Hola, quiero el chatbot de WhatsApp con IA para mi negocio',
  },
  {
    key: 'loyalty',
    title: 'Tarjeta de sellos con QR',
    pitch: 'Para que el cliente vuelva: cada visita suma un sello en su celular y al completar gana su premio.',
    includes: [
      'El cliente se registra con su celular, sin bajar ninguna aplicación',
      'Escanea el QR del local y el mesero le pone el sello con su código',
      'Premios que tú escoges (por ejemplo: 4 sellos 10 % de descuento, 7 un café, 10 un cóctel)',
      'Panel del dueño: clientes, sellos puestos, quién los puso y premios canjeados',
    ],
    price: '$69.000',
    priceNote: 'al mes',
    extra: 'Instalación con el QR para la tablet del local: $150.000.',
    whatsapp: 'Hola, quiero la tarjeta de sellos con QR para que mis clientes vuelvan',
  },
  {
    key: 'menu',
    title: 'Menú digital con QR',
    pitch: 'Tu carta en el celular del cliente: escanea el QR de la mesa y ve tus platos con foto y precio.',
    includes: [
      'Diseño con tus colores, tu logo y fotos de tus platos',
      'Categorías, etiquetas («Más pedido», «Picante») y botón para pedir por WhatsApp',
      'Código QR listo para imprimir en mesas y vitrinas',
      'Si cambias un precio, lo actualizamos y el QR impreso sigue sirviendo',
      'Menú completo: en 4 idiomas, carrito con pedido por WhatsApp, reservas y botones para reseñas en Google y Tripadvisor',
    ],
    price: '$350.000',
    priceNote: 'pago único',
    extra: 'Menú completo: $650.000. Cambios de platos y precios cuando quieras: $40.000 al mes (opcional).',
    whatsapp: 'Hola, quiero un menú digital con QR para mi negocio',
  },
  {
    key: 'restaurant',
    title: 'Restaurant Control',
    pitch: 'El sistema para manejar tu restaurante o bar: mesas, pedidos, cocina, caja e inventario.',
    includes: [
      'Plano de mesas: el mesero toma el pedido desde el celular',
      'Comandas impresas o en pantalla para cocina y barra',
      'Caja, cierre de turno y cuenta de cada mesero',
      'Inventario que se descuenta solo con cada venta y avisa qué se está acabando',
    ],
    price: '$119.000',
    priceNote: 'desde, al mes por sede',
    extra: 'Instalación: $350.000, o $200.000 si también haces tu página con nosotros.',
    whatsapp: 'Hola, quiero Restaurant Control para mi restaurante',
    more: { href: '/software#restaurantes', label: 'Ver planes' },
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
    key: 'video',
    title: 'Página con video que se mueve',
    pitch: 'Una página de impacto para lanzar un producto o tu marca: el video avanza mientras el cliente baja.',
    includes: [
      'Video de portada que se mueve con el dedo o el mouse, como una película',
      'Tu producto estrella, tus precios y tus fotos, en una sola página',
      'Botón directo a WhatsApp para pedir o reservar',
      'Se ve rápida en celular y lista para compartir en tus redes',
    ],
    price: '$990.000',
    priceNote: 'pago único',
    extra: 'Si no tienes video, lo armamos con tus fotos o lo creamos con IA (se cotiza aparte).',
    whatsapp: 'Hola, quiero una página con video que se mueve para mi negocio',
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
    key: 'brand',
    title: 'Manual de marca',
    pitch: 'Las reglas de tu marca en un solo lugar, para que todo lo que publiques se vea del mismo negocio.',
    includes: [
      'Tus colores, tipografías y cómo usar tu logo',
      'Tono para escribir: cómo le hablas a tus clientes',
      'Ejemplos para redes, menú y avisos',
      'En una página web para compartirla con tu equipo o tu diseñador',
    ],
    price: '$450.000',
    priceNote: 'pago único',
    whatsapp: 'Hola, quiero el manual de marca para mi negocio',
  },
  {
    key: 'google',
    title: 'Perfil de Google y reseñas',
    pitch: 'Que te encuentren en Google Maps con buena cara y que tus clientes felices te dejen reseña.',
    includes: [
      'Creamos o arreglamos tu ficha: horario, fotos, WhatsApp, menú y página',
      'QR y botón para que te dejen reseña en un toque',
      'Te enseñamos a responder reseñas, las buenas y las malas',
    ],
    price: '$150.000',
    priceNote: 'pago único',
    whatsapp: 'Hola, quiero arreglar mi perfil de Google y conseguir reseñas',
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
 * Páginas de muestra que hizo 3R y que se venden ya hechas: se adaptan al negocio que la compre (nombre, logo,
 * menú, precios, fotos y WhatsApp). No son clientes: en la portada salen aparte, no en «Trabajos».
 */
export type ReadyMade = {
  title: string;
  url: string;
  image: string;
  kind: string;
  pitch: string;
  includes: string[];
  price: string;
  whatsapp: string;
};
export const READY_MADE: ReadyMade[] = [
  {
    title: '3R Burgers',
    url: 'https://rigobertorrr25-star.github.io/3r-burgers/',
    image: '/muestras/3r-burgers.jpg',
    kind: 'Para hamburgueserías y comidas rápidas',
    pitch: 'Una página de impacto con video que se arma mientras el cliente baja, el combo estrella, el menú y el botón para pedir por WhatsApp.',
    includes: [
      'Le ponemos tu nombre, tu logo y tus colores',
      'Tu menú con tus precios y fotos de tus productos',
      'Tu WhatsApp, tu Instagram y tu zona de domicilios',
      'Publicada y lista para compartir en unos días',
    ],
    price: '$790.000',
    whatsapp: 'Hola, vi la página 3R Burgers y la quiero para mi negocio. Mi negocio es: ',
  },
];
