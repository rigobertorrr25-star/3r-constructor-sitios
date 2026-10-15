// Revisión SEO de una página de 3R, hecha sobre el contenido guardado (sin salir a internet).

export type Level = 'ok' | 'warn' | 'bad';
/** Dónde se arregla: título y descripción aquí; textos y fotos en Página web; lo demás lo hace 3R. */
export type Fix = 'meta' | 'texts' | '3r';
export type Check = { id: string; level: Level; title: string; detail: string; pageId?: string; fix?: Fix };

type Node = { type: string; content?: string; props?: Record<string, unknown>; components?: Node[] };
export type AuditPage = {
  id: string;
  title: string;
  isHomepage: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  doc: { sections?: { components?: Node[] }[] } | null;
};
export type AuditSite = { name: string; published: boolean; customDomain: string | null; pages: AuditPage[] };

const WEIGHT: Record<Level, number> = { ok: 1, warn: 0.5, bad: 0 };

function walk(nodes: Node[] | undefined, out: Node[] = []) {
  for (const n of nodes ?? []) {
    out.push(n);
    walk(n.components, out);
  }
  return out;
}

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
/** El título que de verdad sale en Google (igual que render.ts). */
export const effectiveTitle = (p: AuditPage, siteName: string) => p.seoTitle?.trim() || (p.isHomepage ? siteName : `${p.title} — ${siteName}`);

export function audit(site: AuditSite) {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  add(
    site.published
      ? { id: 'published', level: 'ok', title: 'La página está publicada', detail: 'Google ya la puede encontrar.' }
      : {
          id: 'published',
          level: 'bad',
          title: 'La página no está publicada',
          detail: 'Mientras no esté publicada, Google no la puede mostrar.',
          fix: 'texts',
        },
  );
  add(
    site.customDomain
      ? { id: 'domain', level: 'ok', title: 'Tiene dominio propio', detail: `${site.customDomain} da más confianza y se recuerda mejor.` }
      : {
          id: 'domain',
          level: 'warn',
          title: 'Sin dominio propio',
          detail: 'Un dominio como tunegocio.com da más confianza a clientes y a Google.',
          fix: '3r',
        },
  );

  const all = site.pages.flatMap((p) => walk(p.doc?.sections?.flatMap((s) => s.components ?? [])));
  const text = all
    .filter((n) => ['heading', 'text', 'button'].includes(n.type))
    .map((n) => n.content ?? '')
    .join(' ');
  const hasContact =
    all.some((n) => n.type === 'form') ||
    all.some((n) => n.type === 'button' && /^(https:\/\/wa\.me|https:\/\/api\.whatsapp\.com|tel:|mailto:)/i.test(String(n.props?.href ?? '')));
  add(
    hasContact
      ? { id: 'contact', level: 'ok', title: 'Hay cómo contactarte', detail: 'Tiene botón de WhatsApp, teléfono, correo o formulario.' }
      : {
          id: 'contact',
          level: 'bad',
          title: 'No hay cómo contactarte',
          detail: 'Pon un botón de WhatsApp o de llamada: es lo que más convierte visitas en clientes.',
          fix: 'texts',
        },
  );
  const hasPlace =
    all.some((n) => n.type === 'map' && String(n.props?.address ?? '').trim()) ||
    /\b(calle|carrera|cra\.?|cl\.?|avenida|av\.?|diagonal|transversal|barrio|local)\b.*\d/i.test(text);
  add(
    hasPlace
      ? {
          id: 'place',
          level: 'ok',
          title: 'Se ve dónde queda el negocio',
          detail: 'La dirección ayuda a salir en búsquedas como «café cerca de mí».',
        }
      : {
          id: 'place',
          level: 'warn',
          title: 'No se ve la dirección',
          detail: 'Escribe la dirección o pon un mapa: ayuda a salir en búsquedas locales.',
          fix: 'texts',
        },
  );

  for (const p of site.pages) {
    const nodes = walk(p.doc?.sections?.flatMap((s) => s.components ?? []));
    const name = p.isHomepage ? 'Inicio' : p.title;
    const title = effectiveTitle(p, site.name);
    if (!p.seoTitle?.trim()) {
      add({
        id: `title:${p.id}`,
        level: 'warn',
        title: `${name}: sin título para Google`,
        detail: `Google muestra «${title}». Escribe uno que diga qué vendes y dónde (por ejemplo «Café de especialidad en Cartagena | ${site.name}»).`,
        pageId: p.id,
        fix: 'meta',
      });
    } else if (title.length < 25 || title.length > 65) {
      add({
        id: `title:${p.id}`,
        level: 'warn',
        title: `${name}: el título ${title.length < 25 ? 'es muy corto' : 'es muy largo'}`,
        detail: `Tiene ${title.length} letras; lo ideal es entre 25 y 65 para que Google lo muestre completo.`,
        pageId: p.id,
        fix: 'meta',
      });
    } else add({ id: `title:${p.id}`, level: 'ok', title: `${name}: buen título para Google`, detail: title, pageId: p.id });

    const desc = p.seoDescription?.trim() ?? '';
    if (!desc) {
      add({
        id: `desc:${p.id}`,
        level: 'bad',
        title: `${name}: sin descripción para Google`,
        detail: 'Es el texto que sale debajo del título en Google. Sin ella, Google escoge un pedazo cualquiera de la página.',
        pageId: p.id,
        fix: 'meta',
      });
    } else if (desc.length < 70 || desc.length > 160) {
      add({
        id: `desc:${p.id}`,
        level: 'warn',
        title: `${name}: la descripción ${desc.length < 70 ? 'es muy corta' : 'es muy larga'}`,
        detail: `Tiene ${desc.length} letras; lo ideal es entre 70 y 160.`,
        pageId: p.id,
        fix: 'meta',
      });
    } else add({ id: `desc:${p.id}`, level: 'ok', title: `${name}: buena descripción`, detail: desc, pageId: p.id });

    if (!nodes.some((n) => n.type === 'heading' && n.content?.trim())) {
      add({
        id: `h1:${p.id}`,
        level: 'bad',
        title: `${name}: no tiene un título principal`,
        detail: 'Google usa el título principal de la página para entender de qué trata.',
        pageId: p.id,
        fix: '3r',
      });
    }
    const noAlt = nodes.filter((n) => n.type === 'image' && String(n.props?.src ?? '').trim() && !String(n.props?.alt ?? '').trim()).length;
    if (noAlt) {
      add({
        id: `alt:${p.id}`,
        level: 'warn',
        title: `${name}: ${noAlt} ${noAlt === 1 ? 'foto sin descripción' : 'fotos sin descripción'}`,
        detail: 'Describe qué se ve en cada foto: Google la puede mostrar en imágenes y la leen personas ciegas.',
        pageId: p.id,
        fix: 'texts',
      });
    }
    const deadButtons = nodes.filter((n) => n.type === 'button' && ['', '#'].includes(String(n.props?.href ?? '').trim())).length;
    if (deadButtons) {
      add({
        id: `links:${p.id}`,
        level: 'warn',
        title: `${name}: ${deadButtons} ${deadButtons === 1 ? 'botón no lleva' : 'botones no llevan'} a ningún lado`,
        detail: 'Ponle a cada botón a dónde debe llevar (WhatsApp, una página, un teléfono).',
        pageId: p.id,
        fix: 'texts',
      });
    }
    if (p.isHomepage) {
      const n = words(
        nodes
          .filter((x) => ['heading', 'text'].includes(x.type))
          .map((x) => x.content ?? '')
          .join(' '),
      );
      add(
        n >= 120
          ? { id: 'words', level: 'ok', title: 'Inicio: tiene suficiente texto', detail: `${n} palabras.`, pageId: p.id }
          : {
              id: 'words',
              level: 'warn',
              title: 'Inicio: tiene poco texto',
              detail: `Tiene ${n} palabras. Con 120 o más (qué vendes, para quién, dónde, horarios) Google entiende mejor el negocio.`,
              pageId: p.id,
              fix: 'texts',
            },
      );
    }
  }

  const score = checks.length ? Math.round((checks.reduce((s, c) => s + WEIGHT[c.level], 0) / checks.length) * 100) : 0;
  const order: Record<Level, number> = { bad: 0, warn: 1, ok: 2 };
  checks.sort((a, b) => order[a.level] - order[b.level]);
  return { score, checks };
}
