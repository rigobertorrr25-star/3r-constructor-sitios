# Pasar Restaurant Control a Render (plan B)

Preparado el 24 oct 2026 a pedido de Rigoberto. Hoy el sistema sigue en Vercel
(https://3r-constructor-sitios-git1.vercel.app); esta guía es para el día que se decida pasarlo a Render.
La base de datos **no se mueve**: sigue en Neon, y Vercel y Render pueden usarla al mismo tiempo mientras se prueba.

## Qué está listo

- `restaurante/render.yaml`: la configuración de Render (un servicio web, plan **Starter**, unos 7 dólares al mes).
  Es aparte del `render.yaml` de la raíz, que es el de la API de la tienda: no se toca.
- Probado en la sesión como lo corre Render: instalación limpia, armado en modo producción y arranque en el puerto
  que da Render. El chequeo de salud (`/api/salud`) responde, la portada carga y en una base vacía se crean solas
  las 32 tablas. Prendido usa ~160 MB de los 512 MB del plan.
- No guarda archivos en el disco (las fotos van en la base), así que no necesita disco en Render.

## Antes de mudarse (recomendado): una dirección propia

Tres cosas tienen escrita la dirección de Vercel y dejarían de servir al mudarse:

1. **Los QR de las mesas** (carta QR): se arman con la dirección desde donde se abrió el sistema.
2. **El programa de impresión** de cada local: guarda la dirección en `config.json`.
3. **Los accesos guardados** en los celulares y computadores del equipo.

La solución es usar una dirección propia, por ejemplo `sistema.3rpaginas.com`, primero en Vercel. Con esa
dirección se imprimen los QR, se configuran las impresoras y se guardan los accesos. El día de la mudanza solo
se cambia a dónde apunta esa dirección, y nadie en los restaurantes tiene que hacer nada.

## Paso a paso el día de la mudanza

1. **Región.** En Neon → proyecto `restaurante` → Settings, mira la región de la base.
   AWS `us-east-2` → `ohio` (la que quedó en el archivo), `us-east-1` → `virginia`, `us-west-2` → `oregon`,
   `eu-central-1` → `frankfurt`. Si no es Ohio, pídele a Claude que cambie `region` en `render.yaml` **antes** del
   paso 3 (después no se puede cambiar).
2. **Las cuatro claves.** En Vercel → proyecto de Restaurant Control → Settings → Environment Variables, copia
   `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET` y `ANTHROPIC_API_KEY`.
3. **Crear en Render.** En Render (ya tienes cuenta: ahí está la API de la tienda): New → Blueprint → repositorio
   `3r-constructor-sitios` → en **Blueprint Path** escribe `restaurante/render.yaml` → pega las cuatro claves →
   Apply. Pide tarjeta, porque el plan Starter es pagado.
4. **Esperar el armado** (unos minutos) y abrir la dirección que da Render (`https://restaurant-control-….onrender.com`).
   Probar: entrar con un PIN, abrir una mesa, el Tablero y `/admin`.
5. **Cambiar la dirección**:
   - Con dirección propia: apuntarla a Render (Settings → Custom Domains en Render) y listo.
   - Sin dirección propia: pedirle a Claude que cambie la dirección en `public/impresion/iniciar-windows.bat`;
     en cada computador con el programa de impresión, cerrarlo, borrar `config.json`, abrir `iniciar-windows.bat` y
     escribir la dirección nueva y el código de la sede; volver a imprimir los QR de las mesas (menú «QR y enlaces»);
     y avisarle al equipo la dirección nueva.
6. **Apagar Vercel** cuando todo funcione unos días en Render (Vercel → proyecto → Settings → borrar), y pedirle a
   Claude que actualice las notas (`restaurante/CLAUDE.md`).

## Lo que no se pudo comprobar desde la sesión

- La guía oficial de Render no abre desde la sesión (el proxy bloquea render.com): el archivo usa solo campos
  básicos. Si Render marca un error al crear el Blueprint, mándale a Claude el mensaje.
- El armado midió hasta ~1,5 GB de memoria en la sesión. Si en Render falla por memoria al armar, se sube el plan
  un escalón o Claude ajusta el armado.
- El ingreso con PIN solo se puede probar ya en Render (necesita https).
