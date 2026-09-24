'use client';

import { useState } from 'react';
import { inputClass } from '@/components/field';
import { UploadControl } from '@/components/editor/controls';
import { ACCEPT_IMAGE } from '@/lib/upload';

/** Igual que Field, pero con un botón para subir la captura desde el computador en vez de pegar una URL. */
export function ThumbnailField({ name, label, hint, defaultValue }: { name: string; label: string; hint?: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? '');
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <UploadControl accept={ACCEPT_IMAGE} onUploaded={setValue} />
      <input id={name} name={name} className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://…" maxLength={500} />
      {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
