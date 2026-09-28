'use client';

import { useEffect, useState } from 'react';

type Data = { name: string; svg: string; expiresInMs: number };

const clock = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });
const today = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' });

/** Pantalla de la tablet de la entrada: el QR se renueva solo cada 30 segundos. */
export function AttendanceKiosk({ secret }: { secret: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [problem, setProblem] = useState<'offline' | 'invalid' | null>(null);
  // El reloj arranca en el navegador: la hora del servidor no coincidiría con la de la tablet.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const load = async () => {
      let wait = 5_000;
      try {
        const res = await fetch(`/api/asistencia/kiosco/${encodeURIComponent(secret)}`, { cache: 'no-store' });
        if (res.status === 404) {
          setProblem('invalid');
          setData(null);
          wait = 60_000;
        } else if (res.ok) {
          const next = (await res.json()) as Data;
          setData(next);
          setProblem(null);
          wait = next.expiresInMs + 300;
        } else {
          setProblem('offline');
        }
      } catch {
        setProblem('offline');
      }
      if (!stopped) timer = setTimeout(load, wait);
    };
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [secret]);

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(tick);
  }, []);

  // Que la tablet no apague la pantalla mientras muestra el QR (si el navegador lo permite).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = (await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen')) ?? null;
      } catch {
        lock = null;
      }
    };
    request();
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  if (problem === 'invalid') {
    return (
      <p className="max-w-md text-center text-[18px] text-muted-foreground">
        Este enlace de tablet ya no funciona. Pide al equipo de 3R el enlace nuevo.
      </p>
    );
  }

  return (
    <div className="flex w-full max-w-[560px] flex-col items-center gap-6 text-center">
      <div>
        <p className="font-display text-[clamp(28px,5vw,44px)] font-bold tracking-tight text-foreground">{data?.name ?? ' '}</p>
        <p className="mt-1 text-[18px] text-muted-foreground">Escanea con la cámara de tu celular para marcar entrada o salida</p>
      </div>
      <div className="w-full max-w-[420px] rounded-[32px] bg-white p-5 shadow-[var(--shadow-glow)]">
        {data ? (
          <div className="aspect-square w-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: data.svg }} aria-label="Código QR para marcar asistencia" role="img" />
        ) : (
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-black/10" />
        )}
      </div>
      <div>
        <p className="font-display text-[clamp(36px,7vw,60px)] font-semibold tabular-nums text-foreground">{now ? clock.format(now) : '\u00a0'}</p>
        <p className="text-[18px] first-letter:uppercase text-muted-foreground">{now ? today.format(now) : '\u00a0'}</p>
      </div>
      {problem === 'offline' ? (
        <p className="rounded-2xl bg-[#f7cb58]/15 px-4 py-2 text-[15px] text-[#f7cb58]">Sin conexión. Revisa el wifi de la tablet; se reintenta solo.</p>
      ) : (
        <p className="text-[14px] text-muted-foreground">El código cambia cada 30 segundos. Una foto del código no sirve después.</p>
      )}
    </div>
  );
}
