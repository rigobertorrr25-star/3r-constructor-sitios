# Lore TRAVEL (`clientes/lore-travel/`)

Reglas generales de trabajo (iguales en todos los proyectos de Rigoberto): ver `docs/claude/instrucciones-globales.md`
(se cargan desde el CLAUDE.md de la raíz).

## Estado (actualízalo cuando algo cambie: otras sesiones no recuerdan lo que se habló)

- **7 nov 2026**: Rigoberto mandó el linkbio de Lore TRAVEL (https://linkbio.co/7092607LodvLW, Loreinys Fernández,
  planes de viaje en Cartagena) y pidió «hazme una página». No dijo si es cliente que paga o muestra de venta.
- Página estática (un `index.html` y la carpeta `img`), como ZENOVA. Todo sale del linkbio: textos, 9 planes con su foto
  e Instagram (Baruco by Cuzco, Delirium, Cholón, Quebracho, Playa Tranquila, Sublime Premium Spa, Niku, Cartagena ATV
  —cuatrimotos—, Morena Orígenes), WhatsApp 573006279421 (desde el 21 nov 2026, pedido de Rigoberto; antes 573148918445, el del linkbio), Instagram @ldelcfo, TikTok @ldelcf, Facebook y PayPal
  (paypal.me/LoreinysFernandez). Las descripciones cortas de cada plan las escribió Claude mirando las fotos: Lore debe revisarlas.
  Sin precios (el linkbio no tiene).
- Colores de su marca en el linkbio (coral #F59E95/#EF877D, letra Montserrat) + azul mar para contraste.
- Qué hace: filtros por tipo de plan; «Agregar» junta planes y el formulario «Arma tu plan» (nombre, fecha, personas,
  nota) los manda en un solo mensaje a su WhatsApp; «Reservar» abre WhatsApp con el nombre del plan.
- Para agregar o quitar un plan: lista `PLANES` en el script + foto en `img/`.
- Fotos del linkbio: 400×400 (baja resolución); para una portada grande hacen falta fotos originales.
- Vista previa: https://claude.ai/artifact/8q9SegTdBuz6EaFUomCKC8 (el botón «Enviar mi plan» es un enlace normal desde el 21 nov 2026, así abre WhatsApp también ahí).
- **7 nov 2026, Rigoberto: «Quiero que todo se vuelva una página web»** → publicarla. Va a Cloudflare gratis como ZENOVA
  (ver «Hosting» en el CLAUDE.md de la raíz): proyecto `loretravel` (Worker conectado al repo), rama `main`, sin vistas
  previas, directorio raíz `clientes/lore-travel`, comando `mkdir -p _site && cp -r index.html img _site/`, despliegue
  `npx wrangler deploy --assets=./_site --name=loretravel --compatibility-date=2026-10-01`. Dirección esperada:
  **https://loretravel.rigoberto-rrr25.workers.dev** (ya puesta en `og:image`/`og:url`; si el nombre cambia, cambiarla ahí).
  El proyecto de Cloudflare lo crea Rigoberto (la sesión no entra a Cloudflare).
- **Logo (7 nov 2026, pedido de Rigoberto «crea un logo para Lore TRAVEL»)**: 3 propuestas (A sol con olas al lado del
  nombre, B monograma «L» con ola, C la «o» de Lore es un sol sobre el mar). Claude recomendó y aplicó la **C** (menú,
  pie e ícono de la pestaña); falta que Rigoberto/Lore escojan. Archivos en `clientes/lore-travel/logo/` (SVG que se
  pueden agrandar sin perder calidad + PNG con fondo transparente: `logo` (TRAVEL debajo), `logo-horizontal`, versiones
  `-blanco` para fondos oscuros, `icono` azul y `icono-coral` para foto de perfil). La página usa las copias de `img/`
  (`logo-horizontal*.svg`, `icono-32.png`, `icono-180.png`), porque Cloudflare solo sube `index.html` e `img`.
  Letras convertidas a dibujo (Montserrat ExtraBold 800 y SemiBold 600): no hace falta tener la letra instalada.
- **21 nov 2026: tours, lancha y experiencias de clientes** (lista de Lore por WhatsApp + carpeta de Drive «Página Lore»
  de Rigoberto: 39 fotos y 39 videos). Secciones nuevas: «Tours y experiencias» (11 tours, lista `TOURS`), «Lancha privada»
  (la Blessed Royale: 28 pies, 8 pax, zarpe Muelle de los Pegasos; 6 fotos con miniaturas + franja «más lanchas y yates»),
  «Experiencias de clientes» (lista `CLIENTES`: 15 videos y 7 fotos de un viaje de clientes a Medellín/Guatapé —Peñol,
  museo, golf, Ritwal, bolera, cuatrimotos—; se muestran 11 y «Ver más») y botón «Video» en Cholón, Tour 5 islas y lancha
  (lista `VIDEOS`). «Restaurantes, clubes y más» = los lugares del linkbio (Cholón y cuatrimotos pasaron a tours).
  Archivos: `img/clientes/` (c-*.mp4 + póster .webp), `img/videos/` (v-*.mp4 + póster), fotos en `img/`. Videos recortados
  a 15 s (planes 20 s), 480 px, ~0,3–2 MB. Ninguna foto ni video tenía teléfono visible.
  Quedaron fuera: dos fotos de helicóptero hechas con IA (estrella de Gemini), un catamarán de «Cancun Adventures», dos piezas
  publicitarias de otras empresas (Makarela/Poseidon, Gema Boats), un video con @mambanegra.22 encima, videos repetidos u oscuros.
  Pendiente de confirmar con Lore: textos cortos de Totumo, Palenque, helicóptero y chiva (escritos por Claude).
- **21 nov 2026**: Rigoberto mandó 3 fotos y 2 videos de clientes en Cartagena (embarque en la lancha en el Muelle de los
  Pegasos, frente al Centro de Convenciones). Van de primeros en `CLIENTES` (`c-f-lancha-muelle`, `c-embarque`, `c-f-muelle`,
  `c-muelle`, `c-f-lancha-grupo`); se muestran 13 antes de «Ver más». Sin teléfonos visibles.
- **21 nov 2026**: 2 fotos de chivas de Rigoberto → tour «Chiva rumbera» (`img/chiva-1`, `chiva-2`; botón «Fotos» que abre
  el visor; en `VIDEOS` una entrada sin `v` es foto y el botón dice «Fotos» en vez de «Video»).
- **21 nov 2026: catamarán con jacuzzi** (PDF «MAVI» de Rigoberto, tarifa clientes 2026). Sección `#catamaran` debajo de la
  lancha: 61 pies, capacidades (islas 40, bahía 50, dormir a bordo 8, tripulación 4), pisos, planes Islas/Bahía con precio
  «desde» ($10.500.000 día completo islas; $2.700.000 por 2 h en la bahía) y listas desplegables con comida y servicios
  adicionales con sus precios. **No se nombra al proveedor (MAVI)** para que el cliente reserve con Lore. Fotos sacadas del
  PDF: `img/catamaran-*.webp`, `bahia-atardecer.webp`, `islas-rosario.webp` (esta también es ahora la foto del Tour 5 islas).
  Tour nuevo «Transporte privado» (van y limosina en una sola tarjeta, para que las filas queden parejas). Fotos de Pexels (licencia libre, sin crédito obligatorio) en ciudad, Palenque, Santa Marta y limosina, con botón «Fotos»; Wikimedia Commons rechaza descargas desde la sesión (política de robots, 429). Sin foto: Totumo y la van (pedir a Lore fotos reales).
- **23 nov 2026: página en español e inglés** (pedido de Rigoberto). Botón **ES | EN** arriba (`.idioma`). Idioma inicial:
  enlace terminado en `#en` o `#es` → lo que la persona escogió antes (`localStorage` «lore-idioma») → idioma del celular
  (español si empieza por «es»; si no, inglés). Textos fijos: atributo `data-en` (y `data-en-href`, `data-en-placeholder`)
  en el HTML; listas del script: diccionario `EN` por id (tours y lugares), `t_en` en `CLIENTES` y `VIDEOS`, textos de
  botones y mensajes en `UI`. En inglés los mensajes de WhatsApp salen en inglés y los precios como «COP $10,500,000».
  **Al agregar un texto o un plan nuevo, poner también su inglés.** Menú completo solo desde 1200 px de ancho; en
  pantallas menores quedan logo, ES | EN y WhatsApp (en celulares de menos de 420 px el botón de WhatsApp es solo ícono).
