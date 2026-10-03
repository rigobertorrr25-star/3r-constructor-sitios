import { notFound } from 'next/navigation';
import { cache } from 'react';
import { authedApi } from '@/lib/api';
import type { CompanyDetail } from '@/lib/companies';
import { errorText, type ApiError } from '@/lib/types';

/** La empresa con mi rol. Una sola llamada por petición aunque la pidan el layout y la página. */
export const loadCompany = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await authedApi<CompanyDetail & ApiError>(`/companies/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) return { company: null, error: errorText(res.data, 'No pudimos abrir la empresa.') };
  return { company: res.data, error: null };
});
