// Pruebas del generador de HTML/CSS: seguridad (todo texto ajeno se escapa) y diseño responsive.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { renderPage, renderSitemap, renderRobots } = await import('../dist/publishing/render/render.js');

const ctx = (extra = {}) => ({ siteName: 'Café Azul', isHomepage: true, nav: [], formAction: '/s/cafe-azul/contact', ...extra });
const page = (sections, extra = {}) => ({ title: 'Inicio', doc: { version: 1, sections }, ...extra });
const section = (components, styles) => ({ id: 's1', type: 'hero', styles, components });
const media = (html, width) => {
  const start = html.indexOf(`@media (max-width:${width}){`);
  if (start < 0) return '';
  const next = html.indexOf('@media', start + 1);
  const end = html.indexOf('</style>', start);
  return html.slice(start, next > 0 && next < end ? next : end);
};

describe('renderPage: seguridad', () => {
  it('escapa el texto: un <script> escrito por el cliente no llega como etiqueta', () => {
    const html = renderPage(
      page([
        section([
          { id: 'a', type: 'heading', content: '<script>alert(1)</script>' },
          { id: 'b', type: 'text', content: '<img src=x onerror=alert(2)> & "comillas"' },
        ]),
      ]),
      ctx(),
    );
    assert.ok(!html.includes('<script'), 'no debe haber etiquetas script');
    assert.ok(!html.includes('<img src=x'), 'no debe colarse una etiqueta img');
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(html.includes('&amp; &quot;comillas&quot;'));
  });

  it('escapa el título, la descripción y el nombre del sitio en el head y el menú', () => {
    const html = renderPage(
      { title: 'Inicio', seoTitle: '</title><script>x</script>', seoDescription: '"><script>y</script>', doc: { version: 1, sections: [] } },
      ctx({
        siteName: '<b>Sitio</b>',
        nav: [
          { label: '<i>A</i>', href: '/', current: true },
          { label: 'B', href: '/b', current: false },
        ],
      }),
    );
    assert.ok(!/<script/i.test(html));
    assert.ok(!html.includes('<b>Sitio</b>') && !html.includes('<i>A</i>'));
    assert.ok(html.includes('&lt;/title&gt;&lt;script&gt;'));
  });

  it('no deja romper atributos: alt y src con comillas se escapan', () => {
    const html = renderPage(
      page([section([{ id: 'i', type: 'image', props: { src: 'https://x.com/a.png" onerror="alert(1)', alt: '" onload="alert(2)' } }])]),
      ctx(),
    );
    // Ninguna comilla real (") debe abrir un atributo nuevo dentro de la etiqueta img.
    const tag = /<img[^>]*>/.exec(html)[0];
    const attrs = [...tag.matchAll(/ ([a-z-]+)="/g)].map((m) => m[1]);
    assert.deepEqual(attrs, ['class', 'src', 'alt', 'loading'], tag);
    assert.ok(tag.includes('&quot; onerror=&quot;'));
  });

  it('descarta enlaces e imágenes peligrosos', () => {
    const html = renderPage(
      page([
        section([
          { id: 'b1', type: 'button', content: 'A', props: { href: 'javascript:alert(1)' } },
          { id: 'b2', type: 'button', content: 'B', props: { href: 'JaVaScRiPt:alert(1)' } },
          { id: 'b3', type: 'button', content: 'C', props: { href: 'data:text/html,x' } },
          { id: 'b4', type: 'button', content: 'D', props: { href: '//evil.com' } },
          { id: 'i1', type: 'image', props: { src: 'javascript:alert(1)' } },
          { id: 'i2', type: 'image', props: { src: 'data:image/svg+xml,<svg onload=alert(1)>' } },
          { id: 'v1', type: 'video', props: { src: 'javascript:alert(1)' } },
          { id: 'v2', type: 'video', props: { src: 'https://ejemplo.com/x.mp4', poster: 'javascript:alert(1)' } },
        ]),
      ]),
      ctx(),
    );
    assert.ok(!/javascript:|data:|evil\.com/i.test(html), html);
    assert.ok(!html.includes('<img'), 'sin imagen válida no se dibuja');
    assert.ok(!html.includes('poster='), 'una portada peligrosa se descarta, pero el video sigue');
    assert.ok(html.includes('<video'), 'el video con dirección válida sí se dibuja');
  });

  it('mapa: se publica con la dirección codificada; sin dirección no se dibuja', () => {
    const html = renderPage(
      page([
        section([
          { id: 'm1', type: 'map', props: { address: 'Calle 10 # 5-20 <script>alert(1)</script>, Bogotá' } },
          { id: 'm2', type: 'map', props: {} },
        ]),
      ]),
      ctx(),
    );
    const tag = /<iframe[^>]*>/.exec(html)[0];
    assert.ok(tag.includes('src="https://www.google.com/maps?q='));
    assert.ok(!/<script/i.test(html), html);
    assert.equal((html.match(/<iframe/g) ?? []).length, 1, 'el segundo, sin dirección, no se dibuja');
  });

  it('video: se publica con controles, se sanea la portada y sin dirección no se dibuja', () => {
    const html = renderPage(
      page([
        section([
          { id: 'v1', type: 'video', props: { src: 'https://ejemplo.com/clip.mp4', poster: 'https://ejemplo.com/portada.jpg' } },
          { id: 'v2', type: 'video', props: {} },
        ]),
      ]),
      ctx(),
    );
    const tag = /<video[^>]*>/.exec(html)[0];
    assert.ok(tag.includes('src="https://ejemplo.com/clip.mp4"'));
    assert.ok(tag.includes('poster="https://ejemplo.com/portada.jpg"'));
    assert.ok(tag.includes(' controls'));
    assert.equal((html.match(/<video/g) ?? []).length, 1, 'el segundo, sin dirección, no se dibuja');
  });

  it('los enlaces externos abren en pestaña nueva y segura; los propios no', () => {
    const html = renderPage(
      page([
        section([
          { id: 'b1', type: 'button', content: 'Externo', props: { href: 'https://ejemplo.com/x?a=1&b=2' } },
          { id: 'b2', type: 'button', content: 'Propio', props: { href: '/contacto' } },
          { id: 'b3', type: 'button', content: 'Correo', props: { href: 'mailto:a@b.com' } },
        ]),
      ]),
      ctx(),
    );
    assert.ok(html.includes('href="https://ejemplo.com/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"'));
    assert.ok(html.includes('href="/contacto"') && !html.includes('href="/contacto" target'));
    assert.ok(html.includes('href="mailto:a@b.com"'));
  });

  it('rechaza colores que intenten salirse del CSS', () => {
    const html = renderPage(
      page([
        section(
          [{ id: 'h', type: 'heading', content: 'x', styles: { color: 'red;background:url(https://evil.com/x)', background: '</style><script>alert(1)</script>' } }],
          { background: 'expression(alert(1))' },
        ),
      ]),
      ctx(),
    );
    assert.ok(!/evil\.com|<script|expression|<\/style><script/i.test(html), html);
  });

  it('acepta colores válidos', () => {
    const html = renderPage(
      page([section([{ id: 'h', type: 'heading', content: 'x', styles: { color: '#f2f6f8', background: 'rgb(10, 20, 30)' } }])]),
      ctx(),
    );
    assert.ok(html.includes('color:#f2f6f8') && html.includes('background:rgb(10, 20, 30)'));
  });

  it('ignora números absurdos y tipos desconocidos sin romper la página', () => {
    const html = renderPage(
      page([
        section([
          { id: 'h', type: 'heading', content: 'ok', styles: { fontSize: 99999999, paddingTop: -50, borderRadius: 'x' } },
          { id: 'v', type: 'video', content: 'no se publica' },
          { id: 'z', type: 'script', content: 'nada' },
        ]),
      ]),
      ctx(),
    );
    assert.ok(html.includes('font-size:300px'), 'se limita al máximo');
    assert.ok(!html.includes('no se publica') && !html.includes('nada'));
    assert.ok(html.startsWith('<!doctype html>'));
  });

  it('un documento dañado o vacío sigue dando un HTML válido', () => {
    const docs = [null, undefined, 'texto', 42, {}, { sections: 'x' }, { version: 1, sections: [null, 5, 'a', { components: 'x' }] }];
    for (const doc of docs) {
      const html = renderPage({ title: 'Inicio', doc }, ctx());
      assert.ok(html.startsWith('<!doctype html>') && html.includes('</html>'));
    }
  });
});

describe('renderPage: diseño', () => {
  const hero = section(
    [
      { id: 'h', type: 'heading', content: 'Título', styles: { fontSize: { desktop: 52, tablet: 42, mobile: 34 }, fontWeight: 700, textAlign: 'center', marginTop: 8 } },
      { id: 't', type: 'text', content: 'Texto', styles: { fontSize: 18 } },
    ],
    { background: '#000103', paddingTop: { desktop: 96, mobile: 56 }, paddingBottom: 96, paddingX: 24 },
  );

  it('usa escritorio como base y solo agrega lo que cambia en tablet y móvil', () => {
    const html = renderPage(page([hero]), ctx());
    assert.ok(html.includes('font-size:52px;font-weight:700;text-align:center;margin-top:8px'), html);
    assert.ok(media(html, '1024px').includes('font-size:42px'));
    assert.ok(media(html, '640px').includes('font-size:34px'));
    // La sección hereda 96 en tablet (sin regla) y baja a 56 solo en móvil.
    assert.ok(media(html, '640px').includes('padding-top:56px'));
    assert.ok(!media(html, '1024px').includes('padding-top'));
    assert.ok(html.indexOf('(max-width:1024px)') < html.indexOf('(max-width:640px)'), 'móvil va después para poder ganar');
  });

  it('respeta los márgenes de títulos y textos (el editor y lo publicado coinciden)', () => {
    const html = renderPage(page([hero]), ctx());
    assert.ok(html.includes('margin-top:8px'));
    assert.ok(html.includes('.h{margin:0;'), 'sin margen del navegador por defecto');
  });

  it('el primer título es h1 y los demás h2', () => {
    const html = renderPage(
      page([section([{ id: 'a', type: 'heading', content: 'Uno' }]), section([{ id: 'b', type: 'heading', content: 'Dos' }])]),
      ctx(),
    );
    assert.equal((html.match(/<h1 /g) ?? []).length, 1);
    assert.equal((html.match(/<h2 /g) ?? []).length, 1);
  });

  it('el menú aparece con 2 o más páginas y marca la actual', () => {
    const solo = renderPage(page([]), ctx({ nav: [{ label: 'Inicio', href: '/', current: true }] }));
    assert.ok(!solo.includes('class="top"'));
    const html = renderPage(
      page([]),
      ctx({
        nav: [
          { label: 'Inicio', href: '/', current: true },
          { label: 'Contacto', href: '/contacto', current: false },
        ],
      }),
    );
    assert.ok(html.includes('<a href="/" aria-current="page">Inicio</a>') && html.includes('<a href="/contacto">Contacto</a>'));
  });

  it('título y descripción para buscadores', () => {
    assert.ok(renderPage(page([]), ctx()).includes('<title>Café Azul</title>'), 'portada: nombre del sitio');
    assert.ok(renderPage({ title: 'Contacto', doc: {} }, ctx({ isHomepage: false })).includes('<title>Contacto — Café Azul</title>'));
    const seo = renderPage({ title: 'Inicio', seoTitle: 'Café en Cartagena', seoDescription: 'Comida casera', doc: {} }, ctx());
    assert.ok(seo.includes('<title>Café en Cartagena</title>') && seo.includes('<meta name="description" content="Comida casera">'));
  });

  it('botón, imagen, contenedor, divisor y espacio', () => {
    const html = renderPage(
      page([
        section([
          { id: 'b', type: 'button', content: 'Reservar', props: { href: '#contacto' }, styles: { background: '#ffffff', color: '#3743c9', textAlign: 'center' } },
          { id: 'i', type: 'image', props: { src: 'https://ejemplo.com/foto.jpg', alt: 'Foto' }, styles: { width: { desktop: 100, mobile: 60 }, borderRadius: 12 } },
          { id: 'c', type: 'container', styles: { background: '#f3f4f6', gap: 16 }, components: [{ id: 'ct', type: 'text', content: 'Dentro' }] },
          { id: 'd', type: 'divider', styles: { height: 2, color: '#e5e7eb' } },
          { id: 'sp', type: 'spacer', styles: { height: { desktop: 48, mobile: 24 } } },
        ]),
      ]),
      ctx(),
    );
    assert.ok(html.includes('>Reservar</a>') && html.includes('background:#ffffff'));
    assert.ok(html.includes('src="https://ejemplo.com/foto.jpg" alt="Foto" loading="lazy"'));
    assert.ok(media(html, '640px').includes('width:60%'));
    assert.ok(html.includes('class="box ') && html.includes('gap:16px') && html.includes('>Dentro</p>'));
    assert.ok(html.includes('role="separator"') && html.includes('height:2px'));
    assert.ok(media(html, '640px').includes('height:24px'));
  });

  it('contenedor en columnas (galería): usa grid en escritorio, se puede apilar en móvil', () => {
    const html = renderPage(
      page([
        section([
          {
            id: 'g',
            type: 'container',
            styles: { columns: { desktop: 3, mobile: 1 }, gap: 12 },
            components: [
              { id: 'g1', type: 'image', props: { src: 'https://ejemplo.com/1.jpg' } },
              { id: 'g2', type: 'image', props: { src: 'https://ejemplo.com/2.jpg' } },
            ],
          },
        ]),
      ]),
      ctx(),
    );
    assert.ok(html.includes('display:grid') && html.includes('grid-template-columns:repeat(3, 1fr)'));
    assert.ok(media(html, '640px').includes('display:flex'), 'en móvil debe volver a apilarse (flex)');
    assert.ok(!media(html, '640px').includes('grid-template-columns'), 'en móvil no debe quedar la regla de 3 columnas');
  });

  it('contenedor sin columnas configuradas sigue apilado, como antes', () => {
    const html = renderPage(page([section([{ id: 'c', type: 'container', components: [] }])]), ctx());
    assert.ok(!html.includes('display:grid'));
  });

  it('formulario de contacto: postea a la acción del contexto, con honeypot oculto', () => {
    const html = renderPage(
      page([section([{ id: 'f', type: 'form', props: { title: 'Escríbenos' } }])]),
      ctx({ formAction: '/s/mi-negocio/contact' }),
    );
    assert.ok(html.includes('<form class="form" method="post" action="/s/mi-negocio/contact">'));
    assert.ok(html.includes('name="name"') && html.includes('name="email"') && html.includes('name="phone"') && html.includes('name="message"'));
    assert.ok(html.includes('class="hp" type="text" name="website"'), 'el honeypot debe existir y estar oculto');
    assert.ok(html.includes('>Escríbenos<'));
  });

  it('formulario: la acción se escapa (no se puede inyectar HTML por ahí)', () => {
    const html = renderPage(
      page([section([{ id: 'f', type: 'form' }])]),
      ctx({ formAction: '/s/x/contact"><script>alert(1)</script>' }),
    );
    assert.ok(!/<script>alert/.test(html));
    assert.ok(html.includes('&lt;script&gt;'));
  });

  it('cabecera, sitemap y robots correctos', () => {
    const html = renderPage(page([]), ctx());
    assert.ok(html.includes('<html lang="es">') && html.includes('name="viewport"'));
    const sitemap = renderSitemap('http://a.localhost:3000', ['/', '/x&y']);
    assert.ok(sitemap.includes('<loc>http://a.localhost:3000/</loc>') && sitemap.includes('/x&amp;y'));
    assert.ok(renderRobots('http://a.localhost:3000').includes('Sitemap: http://a.localhost:3000/sitemap.xml'));
  });
});
