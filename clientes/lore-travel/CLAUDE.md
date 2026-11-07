# Lore TRAVEL (`clientes/lore-travel/`)

Reglas generales de trabajo (iguales en todos los proyectos de Rigoberto): ver `docs/claude/instrucciones-globales.md`
(se cargan desde el CLAUDE.md de la raíz).

## Estado (actualízalo cuando algo cambie: otras sesiones no recuerdan lo que se habló)

- **7 nov 2026**: Rigoberto mandó el linkbio de Lore TRAVEL (https://linkbio.co/7092607LodvLW, Loreinys Fernández,
  planes de viaje en Cartagena) y pidió «hazme una página». No dijo si es cliente que paga o muestra de venta.
- Página estática (un `index.html` y la carpeta `img`), como ZENOVA. Todo sale del linkbio: textos, 9 planes con su foto
  e Instagram (Baruco by Cuzco, Delirium, Cholón, Quebracho, Playa Tranquila, Sublime Premium Spa, Niku, Cartagena ATV
  —cuatrimotos—, Morena Orígenes), WhatsApp 573148918445, Instagram @ldelcfo, TikTok @ldelcf, Facebook y PayPal
  (paypal.me/LoreinysFernandez). Las descripciones cortas de cada plan las escribió Claude mirando las fotos: Lore debe revisarlas.
  Sin precios (el linkbio no tiene).
- Colores de su marca en el linkbio (coral #F59E95/#EF877D, letra Montserrat) + azul mar para contraste.
- Qué hace: filtros por tipo de plan; «Agregar» junta planes y el formulario «Arma tu plan» (nombre, fecha, personas,
  nota) los manda en un solo mensaje a su WhatsApp; «Reservar» abre WhatsApp con el nombre del plan.
- Para agregar o quitar un plan: lista `PLANES` en el script + foto en `img/`.
- Fotos del linkbio: 400×400 (baja resolución); para una portada grande hacen falta fotos originales.
- Vista previa: https://claude.ai/artifact/8q9SegTdBuz6EaFUomCKC8 (ahí el botón «Enviar mi plan» puede no abrir WhatsApp; en la página real sí).
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
