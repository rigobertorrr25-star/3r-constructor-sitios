'use client';

import { useState, useTransition } from 'react';
import { voteArticleAction, votePublicArticleAction } from '@/app/empresa/knowledge-actions';

/** "¿Te sirvió?" al final de un artículo (del equipo con `companyId`, o de clientes con `token`). */
export function ArticleVote({
  articleId,
  companyId,
  token,
  initial = null,
}: {
  articleId: string;
  companyId?: string;
  token?: string;
  initial?: boolean | null;
}) {
  const [vote, setVote] = useState<boolean | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = (helpful: boolean) =>
    start(async () => {
      setError(null);
      const res = token ? await votePublicArticleAction(token, articleId, helpful) : await voteArticleAction(companyId!, articleId, helpful);
      if (res && !res.ok) setError(res.error);
      else setVote(helpful);
    });
  const pill = (on: boolean) =>
    `rounded-full border px-4 py-2 text-[14px] transition disabled:opacity-60 ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-white/[0.12] text-foreground hover:bg-white/[0.06]'}`;

  // Los clientes votan una vez (no hay cuenta para cambiarlo).
  if (token && vote !== null) return <p className="text-[14px] text-muted-foreground">¡Gracias por contarnos!</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[15px] text-foreground">¿Te sirvió este artículo?</span>
      <button type="button" disabled={pending} onClick={() => send(true)} className={pill(vote === true)} aria-pressed={vote === true}>
        Sí
      </button>
      <button type="button" disabled={pending} onClick={() => send(false)} className={pill(vote === false)} aria-pressed={vote === false}>
        No
      </button>
      {vote === false && !token ? <span className="text-[13px] text-muted-foreground">Cuéntale a quien lo escribió qué le falta.</span> : null}
      {error ? <span className="text-[13px] text-[#ffb4b5]">{error}</span> : null}
    </div>
  );
}
