import { Fragment, type ReactNode } from 'react';

/** Texto de un artículo con formato sencillo: "## " títulos, "- " listas y párrafos separados por una línea en blanco. */
export function ArticleBody({ body }: { body: string }) {
  const blocks = body
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="max-w-[70ch] space-y-4 text-[16px] leading-relaxed text-foreground/90">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        return (
          <Fragment key={i}>
            {(() => {
              const out: ReactNode[] = [];
              let list: string[] = [];
              let text: string[] = [];
              const flush = (k: string) => {
                if (text.length) {
                  out.push(
                    <p key={`p${k}`} className="whitespace-pre-wrap">
                      {text.join('\n')}
                    </p>,
                  );
                  text = [];
                }
                if (list.length) {
                  out.push(
                    <ul key={`u${k}`} className="list-disc space-y-1.5 pl-6 marker:text-primary">
                      {list.map((li, j) => (
                        <li key={j}>{li}</li>
                      ))}
                    </ul>,
                  );
                  list = [];
                }
              };
              lines.forEach((line, j) => {
                const h = /^#{1,3}\s+(.+)$/.exec(line);
                const li = /^[-*•]\s+(.+)$/.exec(line);
                if (h) {
                  flush(`${j}`);
                  out.push(
                    <h3 key={`h${j}`} className="pt-2 font-display text-[19px] font-semibold text-foreground">
                      {h[1]}
                    </h3>,
                  );
                } else if (li) {
                  if (text.length) flush(`${j}t`);
                  list.push(li[1]);
                } else {
                  if (list.length) flush(`${j}l`);
                  text.push(line);
                }
              });
              flush('end');
              return out;
            })()}
          </Fragment>
        );
      })}
    </div>
  );
}
