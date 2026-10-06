'use client';

import { refreshBriefAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';

export function RefreshBriefButton({ day, scope }: { day: string; scope: string }) {
  return (
    <ActionForm action={refreshBriefAction} className="mt-3" showOk={false}>
      {() => (
        <>
          <input type="hidden" name="day" value={day} />
          <input type="hidden" name="scope" value={scope} />
          <SubmitButton tone="quiet" pendingText="Escribiendo…" className="py-1.5 text-[13px]">
            Escribir de nuevo con los últimos datos
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
