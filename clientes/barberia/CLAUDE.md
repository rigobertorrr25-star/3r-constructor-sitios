# DAMC Barbería (diseño de barbería para hombres)

Página estática de una sola hoja (`index.html` + `img/`). Pedido de Rigoberto el 21 nov 2026: «mezcla esos dos
diseños» a partir de dos videos de TikTok de páginas de barbería. Se llamó «El Filo» hasta el 21 nov 2026; ahora es
**DAMC** (Rigoberto). Barbero: Daniel Mejía, WhatsApp **323 396 6084** (`WHATSAPP = "573233966084"`): ahí llegan las
reservas y los pedidos de la tienda.

- **Se ve como la referencia 1** (21 nov 2026, Rigoberto: «no veo nada del primer video, quiero que se vea igual»):
  una sola escena que avanza al bajar. Encabezado blanco → cliente de espaldas con la capa roja «DAMC» → **recorrido**
  (21 nov 2026, Rigoberto no quiso la pantalla roja): se cierran unas puertas «DA | MC» con el letrero «Abierto», se
  abren, entras a la barbería (`img/portada.jpg`, «Pasa adelante.»), la cámara camina hasta la silla del centro y
  termina en la silla de cerca (`img/silla.jpg`, «Siéntate.» con la carta del turno) → negro → «Escoge tu corte.» en
  fondo oscuro, con la foto que cambia al pasar por cada servicio → «Salidos de esta silla.» → «Nítido desde todos los ángulos.» con contador de grados (000°–359°) → «El que te
  corta.» (Daniel Mejía) → En vivo → «Siéntate.» (carta blanca) → reserva en fondo claro («Tu próximo degradado.»,
  días en fila, reloj para la hora, ticket a la derecha) → **Tienda** («Llévate la marca.») →
  «Antes de venir» (dónde, horario, pagos y preguntas). Regla de horas en el borde derecho.
  - Se quitaron la galería y las pestañas de la referencia 2; las preguntas frecuentes quedaron al final.
- **Imágenes hechas con IA** (OpenArt, carpeta «Barbería El Filo» del proyecto «Personal Project», GPT Image 2.5
  Sunburst, 10 créditos cada una): `img/portada-capa.jpg`. La cuenta gratis les pone el logo de OpenArt; Rigoberto mandó
  su propia versión sin el logo (sin las letras) y se le volvieron a escribir «EL FILO» en Anton sobre la capa, con
  las sombras de la tela (ahora dice «DAMC»; el texto se escribe con un script sobre la foto original sin letras). La
  escena «La última mirada / Y listo» (`capa-quitar.jpg`, con el logo) y la tela roja se quitaron el 21 nov 2026 a
  pedido de Rigoberto.
- **Lupa del antes** (21 nov 2026, Rigoberto, como en la referencia 1): en la portada un círculo dibujado a mano con la
  etiqueta «ANTES» sigue el mouse (o el dedo); dentro se ve `img/portada-antes.jpg` (la misma foto con el pelo largo
  sin cortar, armada con los rizos de la misma foto, sin IA) y fuera el degradado. Si nadie la mueve, ronda sola por
  la cabeza; desaparece al empezar el acercamiento. Si se cambia la portada, hay que rehacer la foto «antes» con el
  mismo encuadre y ajustar `LUPA_CABEZA` (centro de la cabeza en la foto de 1920×1080).
- **Cortes de la casa** (21 nov 2026, Rigoberto mandó 5 fotos reales): sección «Salidos de esta silla.» después de
  los precios (`img/cortes/`: mullet rizado con raya, burst fade mullet, doble raya, mohicano con diseño, mullet liso
  con taper), con etiqueta de papel blanco; tocar uno lo deja escogido en la reserva. Servicios nuevos en la lista:
  Mullet $35.000, Mohicano $32.000, Degradado + diseño $38.000 (Burst fade ya estaba, ahora con foto real). Precios
  de ejemplo. Antes de publicar para un cliente, confirmar que las personas de las fotos dieron permiso.
- **Tienda** (21 nov 2026, Rigoberto vende suéteres y gorras): sección «Llévate la marca.» antes de «Antes de venir».
  `PRODUCTOS` (Suéter DAMC $95.000 tallas S–XL, Gorra DAMC $45.000 talla única; precios de ejemplo) y `COLORES`
  (negro, blanco, rojo). Las prendas se dibujan con código (no hay fotos todavía); el cliente escoge color, talla y
  cantidad y el botón abre WhatsApp con el pedido. Cuando Rigoberto mande fotos, cambiarlas por las reales.
- **Solo para hombres** (21 nov 2026, Rigoberto): se atienden hombres y niños.
- **Un solo barbero: Daniel Mejía** (21 nov 2026, Rigoberto quitó a los demás). Su foto está pendiente (la manda
  Rigoberto): mientras tanto se ven sus iniciales «DM». Cuando llegue, guardarla como `img/equipo-daniel.jpg` y poner
  `foto: "img/equipo-daniel.jpg"` en `BARBEROS`. La reserva ya no pide escoger barbero.
- **Reloj para escoger la hora** (21 nov 2026, Rigoberto): en «El momento» hay un reloj de agujas; cada turno libre de
  45 min es un botón alrededor del reloj (los ocupados salen grises y tachados) y las agujas marcan la hora escogida.
  Al lado, la fila en vivo: cuántas personas esperan, si Daniel está motilando, cuánto tardan si llegas sin cita y
  el primer turno libre de hoy. Para hoy no se puede reservar antes de que pase la fila (`esperaAhora`).
- **Cada cliente dura 45 minutos** (21 nov 2026, Rigoberto): todos los servicios duran 45 min, las horas de reserva
  van cada 45 min y la espera se calcula con eso (`DURACION`); el rango es ±5 min por persona en fila, mínimo ±10
  (`VARIACION`).
- **Fila en vivo** (sección «En vivo», 21 nov 2026, Rigoberto): los clientes ven cuántos esperan, si cada barbero está
  motilando (y cuánto lleva del corte), y cuánto les tocaría esperar si llegan ya, con la hora aproximada. La fila
  tiene una sola silla (`barberos.daniel` en `fila/estado`). El barbero
  la mueve desde el «Panel del barbero» (Empezar corte, Terminé, +1 / −1 en fila, Descanso).
  - En la vista previa funciona de verdad: un solo documento `fila/estado` en la base de datos compartida; leen
    todos, escribe solo quien administra (regla `write: admin`). El panel solo le aparece a quien puede editar.
  - En el archivo `index.html` suelto (sin la vista previa) no hay servidor: muestra datos de ejemplo y el panel
    cambia solo ese dispositivo. **Para un cliente real hace falta un pequeño servidor** que guarde la fila (por
    ejemplo la API de `apps/api` en Render o un Worker de Cloudflare con almacenamiento) y una clave para el barbero.
- No hay pago en línea: al confirmar se abre WhatsApp con la reserva escrita. Las horas ocupadas son de ejemplo
  (se calculan solas), no hay agenda real detrás.
- **De ejemplo todavía** (también el estado inicial de la fila): dirección (Calle 27 # 24-15, Manga, Cartagena),
  horario, precios de cortes y de la tienda. Los datos se cambian arriba del `<script>` (WHATSAPP, SERVICIOS, BARBEROS,
  HORARIO) y en los textos del HTML.
- Fotos restantes: Unsplash (licencia libre, sin atribución obligatoria). Cambiarlas por las del negocio real cuando haya cliente.
- Vista previa privada para Rigoberto: https://claude.ai/artifact/5W7SfJ3inW7sUoVgZexYKo (se publica desde una copia
  sin `<html>/<head>/<body>`; si se cambia `index.html`, regenerar la copia y volver a publicar).
- Sin hosting todavía. Si se publica, ir a Cloudflare gratis como ZENOVA (ver CLAUDE.md de la raíz).
