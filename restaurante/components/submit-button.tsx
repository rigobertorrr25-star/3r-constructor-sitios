'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';
import { useT } from './i18n';
import { dangerButton, primaryButton, quietButton } from './ui';

export function SubmitButton({
  children,
  pendingText,
  tone = 'primary',
  className = '',
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  tone?: 'primary' | 'quiet' | 'danger';
  className?: string;
  name?: string;
  value?: string;
}) {
  const t = useT();
  const { pending } = useFormStatus();
  const base = tone === 'primary' ? primaryButton : tone === 'danger' ? dangerButton : quietButton;
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${base} ${className}`}>
      {pending ? (pendingText ?? t('Un momento…')) : children}
    </button>
  );
}
