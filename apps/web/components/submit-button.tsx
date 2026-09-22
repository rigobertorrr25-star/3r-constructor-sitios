'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

export function SubmitButton({ children, pendingText }: { children: ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition duration-300 ease-[var(--ease-emphasized)] hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? pendingText : children}
    </button>
  );
}
