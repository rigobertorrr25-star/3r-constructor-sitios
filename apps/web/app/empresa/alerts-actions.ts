'use server';

import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';

export async function readAllAlertsAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`/companies/${encodeURIComponent(companyId)}/alerts/read-all`, { method: 'POST' });
  revalidatePath(`/empresa/${companyId}`, 'layout');
}
