# El Filo Barbería (diseño de barbería para hombres)

Página estática de una sola hoja (`index.html` + `img/`), sin dueño todavía. Pedido de Rigoberto el 21 nov 2026:
«mezcla esos dos diseños» a partir de dos videos de TikTok de páginas de barbería.

- **Se ve como la referencia 1** (21 nov 2026, Rigoberto: «no veo nada del primer video, quiero que se vea igual»):
  una sola escena que avanza al bajar. Encabezado blanco → cliente de espaldas con la capa roja «EL FILO» → la cámara
  entra en la capa → tela roja («La capa sobre los hombros.») → «Escoge tu corte.» sobre la tela, con la foto que cambia
  al pasar por cada servicio → «Nítido desde todos los ángulos.» con contador de grados (000°–359°) → «A cada uno su
  oficio.» (fotos en blanco y negro con papel blanco) → En vivo → «Siéntate.» (carta blanca) → «La última mirada.» /
  «Y listo.» (le quitan la capa) → reserva en fondo claro («Tu próximo degradado.», días en fila, ticket a la derecha) →
  «Antes de venir» (dónde, horario, pagos y preguntas). Regla de horas en el borde derecho.
  - Se quitaron la galería y las pestañas de la referencia 2; las preguntas frecuentes quedaron al final.
- **Imágenes hechas con IA** (OpenArt, carpeta «Barbería El Filo» del proyecto «Personal Project», GPT Image 2.5
  Sunburst, 10 créditos cada una): `img/portada-capa.jpg` y `img/capa-quitar.jpg`. La cuenta gratis les pone el logo
  de OpenArt. **Portada** (21 nov 2026): Rigoberto mandó su propia versión sin el logo (sin las letras); se le
  volvieron a escribir «EL FILO» en Anton sobre la capa, con las sombras de la tela. **`capa-quitar.jpg` todavía
  trae el logo** (falta que Rigoberto mande su versión, o un plan de pago). `img/tela-roja.jpg` se dibujó con código (no es foto).
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
- **Solo para hombres** (21 nov 2026, Rigoberto): los tres barberos son hombres (Álvaro, Andrés, Julián) y se
  atienden hombres y niños.
- **Cada cliente dura 45 minutos** (21 nov 2026, Rigoberto): todos los servicios duran 45 min, las horas de reserva
  van cada 45 min y la espera se calcula con eso (`DURACION`); el rango es ±5 min por persona en fila, mínimo ±10
  (`VARIACION`).
- **Fila en vivo** (sección «En vivo», 21 nov 2026, Rigoberto): los clientes ven cuántos esperan, si cada barbero está
  motilando (y cuánto lleva del corte), y cuánto les tocaría esperar si llegan ya, con la hora aproximada. El barbero
  la mueve desde el «Panel del barbero» (Empezar corte, Terminé, +1 / −1 en fila, Descanso).
  - En la vista previa funciona de verdad: un solo documento `fila/estado` en la base de datos compartida; leen
    todos, escribe solo quien administra (regla `write: admin`). El panel solo le aparece a quien puede editar.
  - En el archivo `index.html` suelto (sin la vista previa) no hay servidor: muestra datos de ejemplo y el panel
    cambia solo ese dispositivo. **Para un cliente real hace falta un pequeño servidor** que guarde la fila (por
    ejemplo la API de `apps/api` en Render o un Worker de Cloudflare con almacenamiento) y una clave para el barbero.
- No hay pago en línea: al confirmar se abre WhatsApp con la reserva escrita. Las horas ocupadas son de ejemplo
  (se calculan solas), no hay agenda real detrás.
- **Todo es de ejemplo** (también el estado inicial de la fila): nombre «El Filo», dirección (Calle 27 # 24-15, Manga, Cartagena), historia, barberos,
  precios y el WhatsApp `573000000000`. Los datos se cambian arriba del `<script>` (WHATSAPP, SERVICIOS, BARBEROS,
  HORARIO) y en los textos del HTML.
- Fotos restantes: Unsplash (licencia libre, sin atribución obligatoria). Cambiarlas por las del negocio real cuando haya cliente.
- Vista previa privada para Rigoberto: https://claude.ai/artifact/5W7SfJ3inW7sUoVgZexYKo (se publica desde una copia
  sin `<html>/<head>/<body>`; si se cambia `index.html`, regenerar la copia y volver a publicar).
- Sin hosting todavía. Si se publica, ir a Cloudflare gratis como ZENOVA (ver CLAUDE.md de la raíz).
