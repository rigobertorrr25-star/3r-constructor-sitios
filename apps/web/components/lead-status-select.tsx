'use client';

import { useRef } from 'react';
import { updateLeadAction } from '@/app/actions';
import { LEAD_LABEL, LEAD_STAGES } from '@/lib/orders';
import type { LeadStatus } from '@/lib/types';

/** Cambia el estado apenas se elige uno: es el embudo, no hace falta un botón aparte de "guardar". */
export function LeadStatusSelect({ orderId, leadId, status }: { orderId: string; leadId: string; status: LeadStatus }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={updateLeadAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="leadId" value={leadId} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-full border border-white/[0.1] bg-white/[0.02] px-3 py-1 text-[12.5px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        {LEAD_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {LEAD_LABEL[stage]}
          </option>
        ))}
      </select>
    </form>
  );
}
