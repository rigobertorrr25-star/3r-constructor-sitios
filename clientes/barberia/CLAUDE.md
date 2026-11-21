# El Filo Barbería (diseño de barbería para hombres)

Página estática de una sola hoja (`index.html` + `img/`), sin dueño todavía. Pedido de Rigoberto el 21 nov 2026:
«mezcla esos dos diseños» a partir de dos videos de TikTok de páginas de barbería.

- **De la referencia 1** (barbería rojo y negro): rojo de capa, títulos grandes condensados (Anton), lista de precios
  sobre fondo rojo, sección de ángulos con contador de grados al bajar, fichas del equipo en blanco y negro con
  papel blanco encima, ticket de reserva a la derecha y regla vertical en el borde (aquí marca la hora del día).
- **De la referencia 2** (barbería negra premium): fondo negro, galería con foto grande y miniaturas, «Sobre la
  barbería» por pestañas (historia, ubicación, horario, formas de pago), preguntas frecuentes en acordeón y reserva
  con servicio, barbero, calendario, horas libres y forma de pago (pagar en el local o anticipo del 50 %).
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
  HORARIO, GALERIA) y en los textos del HTML.
- Fotos: Unsplash (licencia libre, sin atribución obligatoria). Cambiarlas por las del negocio real cuando haya cliente.
- Vista previa privada para Rigoberto: https://claude.ai/artifact/5W7SfJ3inW7sUoVgZexYKo (se publica desde una copia
  sin `<html>/<head>/<body>`; si se cambia `index.html`, regenerar la copia y volver a publicar).
- Sin hosting todavía. Si se publica, ir a Cloudflare gratis como ZENOVA (ver CLAUDE.md de la raíz).
