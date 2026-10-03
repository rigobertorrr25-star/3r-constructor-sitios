'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Vuelve a pedir la página cada tantos segundos (por ejemplo, mientras sale una campaña). */
export function AutoRefresh({ seconds = 4 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
