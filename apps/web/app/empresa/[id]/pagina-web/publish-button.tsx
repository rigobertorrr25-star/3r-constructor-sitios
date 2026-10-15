'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { publishWebAction } from '@/app/empresa/web-actions';

export function PublishButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await publishWebAction(companyId);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
        className="rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
      >
        {pending ? 'Publicando…' : 'Publicar los cambios'}
      </button>
      {error ? <p className="mt-2 max-w-xs text-[13px] text-[#ffb4b5]">{error}</p> : null}
    </div>
  );
}
