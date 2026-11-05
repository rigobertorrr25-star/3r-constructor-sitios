# Instagram y ventas de 3R (`marketing/`)

Reglas generales de trabajo (iguales en todos los proyectos de Rigoberto): ver `docs/claude/instrucciones-globales.md`
(se cargan desde el CLAUDE.md de la raíz).

## Estado (actualízalo cuando algo cambie: otras sesiones no recuerdan lo que se habló)

- Instagram: se entregó foto de perfil, carrusel de presentación y el contenido de octubre 2026 (calendario en
  https://claude.ai/artifact/6A1HRPqkdhT4PwXqbvon6Q). Rigoberto programó hasta el 15 oct. Segundo paquete (16 oct –
  15 nov: piezas 8–14 de octubre + 6 nuevas de noviembre + 15 historias con sticker por día) en
  https://claude.ai/artifact/LS8mhicvdzLWUUdHDGAMvp. El post del 14 nov (pago en línea) ya puede salir (Wompi en
  producción). Tercer paquete (16 nov – 31 dic: 20 publicaciones con 4 reels de asistencia QR, cuenta
  del cliente y Azul Caribe en 3 pantallas, 17 historias) en https://claude.ai/artifact/Kef33AtRmyGxDg6XH14CUy.
  **Plan de ventas 17 oct – 15 nov 2026** (reemplaza el segundo paquete en esas fechas; hecho con datos de Chatplace):
  https://claude.ai/artifact/KF4eeSwkMd63iUBhe4j1su (13 publicaciones mar/jue/sáb 7 p. m., historias diarias, comparación con
  la competencia, bio nueva). Chatplace está conectado al Instagram (bot «3Rpaginas»); su saldo de IA está en 0, así que no
  analiza competencia ni genera contenido. Ahí hay 3 automatizaciones de comentario/mensaje, **prendidas el 16 oct 2026** (PRECIOS, BURGER,
  CHATBOT/SELLOS → mensaje privado con precios y enlace, una vez al día por persona). Datos de la cuenta
  (16 oct): 3.961 seguidores, mediana 57 vistas por reel, mejor reel 3R Burgers (495). Siguiente: enero 2027. Rigoberto
  programa en Meta Business Suite.
  **Contenido grabado de verdad** (16 oct 2026, pedido de Rigoberto: «que no se vea IA»): `marketing/instagram/2026-10/`
  (4 reels 1080x1920 grabados de las páginas reales —Azul Caribe en 4 idiomas, 3R Burgers, tarjeta de sellos, pedido en
  Fidelio— y un carrusel de capturas reales; `publicaciones.json` con fecha, hora y texto, sin numerales ni signo de
  porcentaje). Se hicieron con Playwright (screencast del celular) + ffmpeg, textos estilo Instagram. Instagram está
  conectado por Composio (IG user 17841455473211605): se probó crear un contenedor sin publicar y quedó FINISHED (subir
  el archivo con upload_local_file y pasar video_file/s3key; la URL raw de GitHub llega como octet-stream). Publicar solo a
  una hora quedó bloqueado por el sistema de seguridad (rutinas sin conectores; recordatorios negados): Rigoberto programa
  en Meta Business Suite o pide publicar en el momento. El reel del chatbot no se grabó: aquí no hay IA real ni WhatsApp
  conectado y no se finge. La primera edición (cajitas de texto, lenta, sin música) **no le gustó a Rigoberto**; la segunda
  (misma carpeta) es estilo TikTok: cortes al ritmo de 124 BPM, celular inclinado sobre fondo desenfocado, zooms, textos Sora
  800 en mayúsculas con borde y rebote, música original por código. **A Rigoberto le gustó este estilo (16 oct 2026): usarlo en el contenido que sigue (enero 2027).** Después (16 oct) se sumaron 8 piezas más en el mismo estilo, del 29 oct al 14 nov (r6 Caprichos, r7 carta de Azul en Halloween, r8 y r12 Restaurant Control con «Bar La Ola (demo)», r9 manual de marca de Azul —con permiso de Azul, 16 oct 2026—, r10 asistencia con «Café La Bahía (demo)», r11 reseñas en Google, c13 carrusel de precios): 13 piezas en total en `publicaciones.json`. También 16 historias (h01–h16, 18 oct – 13 nov, 12:30 p. m.) en `historias/`, listadas en `publicaciones.json` → `historias`. **Programadas el 16 oct 2026** (con permiso de Rigoberto, en modo «Accept edits») como recordatorios de esta sesión que publican por Composio: 13 del muro a las 7 p. m. (r1 salió el mismo 16 oct) y 16 historias a las 12:30 p. m.; el 18 oct, a pedido de Rigoberto («que ningún día quede sin movimientos»), 12 historias más (h17–h28, una en cada día de publicación, anunciando el reel de las 7 p. m.): h17–h24 quedaron programadas; **h25, h26, h27 y h28 (7, 10, 12 y 14 nov) no se pudieron programar** (el filtro del modo Auto lo negó): cuando se dispare la publicación del muro de esos días (r10, r11, r12, c13), publicar también la historia del mismo día justo antes del reel. Se ven en la lista de rutinas de Rigoberto («Instagram: …»). Herramientas en el scratchpad de la sesión (tk/editor.html,
  render.mjs, beat.py); si se pierden, rehacerlas así.
- **Ventas (19 oct 2026):** presentación «3R — Todo para tu negocio» (13 diapositivas: páginas y menús QR, sellos, asistencia, Restaurant Control, software para empresas, precios y cierre por WhatsApp) en https://claude.ai/artifact/YLSty9qGHqqbSmL28SBRbj. Base de 405 negocios de Cartagena y Barranquilla (Google Maps, datos públicos, sin cadenas; prioridad = no tiene página) con hoja de mensajes de WhatsApp por tipo de negocio, entregada como Excel; **no se sube al repositorio** (datos de contacto, Ley 1581: escribir uno por uno, quitar a quien lo pida).
- Instagram de 3R: https://www.instagram.com/3r.paginas_/ (en el pie de la portada y en los datos para Google).
