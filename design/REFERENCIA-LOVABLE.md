# Referencia de diseño (extraída de la vista previa de Lovable)

Fuente: página pública de la vista previa de Lovable (solo la portada; las pantallas internas exigen cuenta y no se vieron).
La referencia es una landing de "Marketing Campaign Command Center". Aquí solo se toma el **sistema visual**, no el contenido.

## Estructura de la portada
1. **Header**: logo (icono de 22px + nombre en Manrope 500, 15px) a la izquierda; botón "Iniciar sesión" a la derecha (píldora con borde translúcido).
2. **Hero centrado**, ancho máx. ~816px:
   - Eyebrow en mayúsculas: 12.75px, letter-spacing ~3.8px, color muted.
   - H1 en Sora 700, 63.75px, line-height 79.7px, letter-spacing -1.6px, 2 líneas.
   - Párrafo: 19px / 29.75px, color muted, ancho máx. ~612px.
   - Dos botones en píldora: primario (fondo #8a9bff, texto #060815, 500) y secundario (fondo blanco 1.4 %, borde blanco 8 %).
3. **"Qué hay dentro"**: título eyebrow centrado y 5 tarjetas en fila (~218 × 283 px, gap ~17px).
   - Cada tarjeta: icono en círculo de 43px (fondo oklch(0.30 0.12 H / .5), icono oklch(0.92 0.08 H), 20px), título en Sora ~20px, descripción en Manrope 15px muted.
   - Matices (H) de los iconos: 150 (verde), 275 (índigo), 88 (ámbar), 200 (cian), rojo/naranja.
   - Tarjeta con radio grande (~32px), borde 1px blanco ~8 %, fondo ligeramente más claro que la página.
4. **Footer**: línea divisoria fina y copyright centrado, 14px, muted.

## Tipografía
- Titulares: **Sora** (respaldo Urbanist), 700.
- Cuerpo: **Manrope** (respaldo Epilogue, Inter Tight).

## Tokens de color (modo oscuro único)
```
--surface-0:#000103  --surface-1:#04080d  --surface-2:#0a131a
--background:#000103  --foreground:#f2f6f8
--card:#04080d  --popover:#0a131a
--primary:#8a9bff  --primary-foreground:#060815
--secondary:#ff86db  --secondary-foreground:#180613
--accent:#d6b0ff  --accent-foreground:#11081b
--muted:#171b22  --muted-foreground:#a5abb5
--destructive:#f94144
--border:#ffffff0f  --input:#ffffff0a  --ring:#8a9bff8c
--glass:#ffffff09  --glass-strong:#ffffff11  --glass-border:#ffffff14
--radius:16px
```

## Efectos
```
--gradient-hero:
  radial-gradient(ellipse 60% 50% at 85% -10%, #8a9bff38, transparent 60%),
  radial-gradient(ellipse 50% 50% at -10% 110%, #ff86db29, transparent 60%),
  radial-gradient(ellipse 40% 40% at 50% 110%, #d6b0ff1a, transparent 70%);
--gradient-spectrum: linear-gradient(100deg,#8a9bff 0%,#cf9bff 28%,#ff86db 55%,#ff9479 82%,#f7cb58 100%);
--gradient-aurora:
  radial-gradient(60% 80% at 30% 20%, #8a9bff80, transparent 70%),
  radial-gradient(50% 70% at 80% 0%, #ff86db73, transparent 70%),
  radial-gradient(70% 90% at 50% 100%, #f7cb5840, transparent 70%);
--shadow-glass: inset 0 1px 0 0 #ffffff0d, 0 0 0 1px #ffffff0a, 0 24px 60px -24px #000c;
--shadow-glow: 0 0 40px -6px #8a9bff66;
--shadow-accent: 0 8px 32px -8px #ff86db47;
--ease-emphasized: cubic-bezier(.16,1,.3,1);
```

## Notas
- El logo original es un icono de 64×64 con degradados (índigo, cian, etc.) generado por un componente propio. Hay que dibujar un logo **propio**, no copiar ese SVG.
- Hay una etiqueta "Hecho con Lovable" flotante: no se replica.
- Todo el contenido se reescribe para el producto (constructor de sitios web).
