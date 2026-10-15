import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyLink } from '@/components/copy-link';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { atLeast } from '@/lib/companies';
import type { WebOverview } from '@/lib/company-web';
import { DEVICE_LABEL, change, sourceLabel, type AnalyticsReport } from '@/lib/analytics';
import { cop } from '@/lib/store';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Analítica — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const fmt = (n: number) => new Intl.NumberFormat('es-CO').format(n);
const dayShort = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLong = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const asDate = (d: string) => new Date(`${d}T12:00:00Z`);

function Stat({ label, value, now, before, hint }: { label: string; value: string; now?: number; before?: number; hint?: string }) {
  const c = now !== undefined && before !== undefined ? change(now, before) : null;
  return (
    <div className={card}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-[28px] font-bold text-foreground">{value}</p>
      <p className="text-[12.5px] text-muted-foreground">
        {c ? (
          <>
            <span className="text-foreground/90">{c.text}</span> frente al periodo anterior
          </>
        ) : (
          (hint ?? ' ')
        )}
      </p>
    </div>
  );
}

/** Visitas por día: barras finas con el número al pasar el mouse o con el teclado. */
function DailyChart({ daily }: { daily: { day: string; views: number; visitors: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.views));
  const ticks = [0, Math.floor((daily.length - 1) / 2), daily.length - 1];
  return (
    <figure>
      <div className="relative">
        <span className="absolute -top-1 left-0 text-[11.5px] tabular-nums text-muted-foreground">{fmt(max)}</span>
        <div className="flex h-48 items-end gap-[2px] border-b border-white/[0.12] pt-5" role="list" aria-label="Visitas por día">
          {daily.map((d) => (
            <div
              key={d.day}
              role="listitem"
              tabIndex={0}
              className="group relative flex h-full flex-1 items-end outline-none"
              aria-label={`${dayLong.format(asDate(d.day))}: ${d.views} visitas, ${d.visitors} personas`}
            >
              <span
                className="block w-full rounded-t-[4px] bg-primary transition group-hover:brightness-125 group-focus:brightness-125"
                style={{ height: d.views ? `${Math.max(3, (d.views / max) * 100)}%` : '0%' }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/[0.1] bg-[#0b0f17] px-3 py-2 text-[12.5px] text-foreground shadow-lg group-hover:block group-focus:block">
                <span className="block text-muted-foreground">{dayLong.format(asDate(d.day))}</span>
                {fmt(d.views)} visitas · {fmt(d.visitors)} personas
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="relative mt-2 h-4 text-[11.5px] text-muted-foreground">
        {ticks.map((i, k) => (
          <span
            key={i}
            className="absolute"
            style={
              k === 0
                ? { left: 0 }
                : k === 2
                  ? { right: 0 }
                  : { left: `${(i / Math.max(1, daily.length - 1)) * 100}%`, transform: 'translateX(-50%)' }
            }
          >
            {dayShort.format(asDate(daily[i].day))}
          </span>
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground">Ver como tabla</summary>
        <table className="mt-2 w-full text-[13.5px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-normal">Día</th>
              <th className="py-1 text-right font-normal">Visitas</th>
              <th className="py-1 text-right font-normal">Personas</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.day} className="border-t border-white/[0.06]">
                <td className="py-1 text-foreground">{dayLong.format(asDate(d.day))}</td>
                <td className="py-1 text-right tabular-nums text-foreground">{fmt(d.views)}</td>
                <td className="py-1 text-right tabular-nums text-foreground">{fmt(d.visitors)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Lista con barra horizontal (un solo color: es cantidad, no categoría). */
function BarList({ rows, unit }: { rows: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="truncate text-foreground">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {fmt(r.value)} {unit} · {total ? Math.round((r.value / total) * 100) : 0} %
            </span>
          </div>
          <span className="block h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function AnalyticsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dias?: string }> }) {
  const { id } = await params;
  const { dias } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'analytics')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Analítica"
        text="Cuántas personas visitan tu página, de dónde llegan (Google, Instagram, WhatsApp…), desde qué dispositivo y cuántos te escriben. Sin cookies."
      />
    );
  }
  if (!atLeast(company.me.role, 'supervisor')) {
    return <p className={`${card} text-[15px] text-muted-foreground`}>La analítica la ven los supervisores y administradores de la empresa.</p>;
  }
  const days = [7, 30, 90].includes(Number(dias)) ? Number(dias) : 30;
  const [{ data: r }, web] = await Promise.all([
    authedApi<AnalyticsReport>(`/companies/${id}/analytics?days=${days}`),
    company.modules.find((m) => m.key === 'web')?.enabled
      ? authedApi<WebOverview>(`/companies/${id}/web`).then((x) => (x.ok ? x.data : null))
      : Promise.resolve(null),
  ]);
  const siteUrl = web?.site?.publication.customUrl ?? web?.site?.publication.url ?? null;
  const chip = (on: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-[13px] transition ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`;
  const w = r.web;
  const devices = w
    ? (['mobile', 'desktop', 'tablet'] as const).filter((k) => w.devices[k]).map((k) => ({ label: DEVICE_LABEL[k], value: w.devices[k] ?? 0 }))
    : [];

  return (
    <div className="space-y-6">
      <nav aria-label="Periodo" className="flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((d) => (
          <Link key={d} href={`/empresa/${id}/analitica?dias=${d}`} className={chip(days === d)} aria-current={days === d ? 'page' : undefined}>
            Últimos {d} días
          </Link>
        ))}
        <span className="ml-auto text-[12.5px] text-muted-foreground">
          {dayShort.format(asDate(r.from))} – {dayShort.format(asDate(r.to))}
        </span>
      </nav>

      {!w ? (
        <section className={card}>
          <h2 className="font-display text-[19px] font-semibold text-foreground">Tu página todavía no está conectada</h2>
          <p className="mt-1 text-[14.5px] text-muted-foreground">Cuando el equipo de 3R conecte tu página a la empresa, aquí verás sus visitas.</p>
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Personas" value={fmt(w.visitors)} now={w.visitors} before={w.previous.visitors} hint="Visitantes distintos por día" />
            <Stat label="Visitas a páginas" value={fmt(w.views)} now={w.views} before={w.previous.views} />
            <Stat label="Mensajes del formulario" value={fmt(w.contacts)} hint="Desde el formulario de contacto" />
            <Stat
              label="Llegan desde el celular"
              value={`${
                w.visitors
                  ? Math.round(
                      ((w.devices.mobile ?? 0) /
                        Math.max(
                          1,
                          Object.values(w.devices).reduce((a, b) => a + (b ?? 0), 0),
                        )) *
                        100,
                    )
                  : 0
              } %`}
              hint="Por eso tu página debe verse bien en el celular"
            />
          </div>

          <section className={card} aria-labelledby="h-diario">
            <h2 id="h-diario" className="mb-5 font-display text-[18px] font-semibold text-foreground">
              Visitas por día
            </h2>
            {w.views ? (
              <DailyChart daily={w.daily} />
            ) : (
              <p className="text-[14.5px] text-muted-foreground">Todavía no hay visitas en este periodo.</p>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className={card} aria-labelledby="h-origen">
              <h2 id="h-origen" className="mb-4 font-display text-[18px] font-semibold text-foreground">
                ¿De dónde llegan?
              </h2>
              {w.sources.length ? (
                <BarList rows={w.sources.map((s) => ({ label: sourceLabel(s.source), value: s.visitors }))} unit="personas" />
              ) : (
                <p className="text-[14px] text-muted-foreground">Sin datos todavía.</p>
              )}
              <p className="mt-4 text-[12.5px] text-muted-foreground">
                «Directo»: escribieron la dirección o abrieron un enlace que no dice de dónde viene.
              </p>
            </section>
            <section className={card} aria-labelledby="h-paginas">
              <h2 id="h-paginas" className="mb-4 font-display text-[18px] font-semibold text-foreground">
                Páginas más vistas
              </h2>
              {w.pages.length ? (
                <BarList rows={w.pages.map((p) => ({ label: p.path === '/' ? 'Inicio' : p.path, value: p.views }))} unit="visitas" />
              ) : (
                <p className="text-[14px] text-muted-foreground">Sin datos todavía.</p>
              )}
              {devices.length ? (
                <div className="mt-6">
                  <h3 className="mb-3 text-[14px] font-medium text-foreground">Dispositivo</h3>
                  <BarList rows={devices} unit="personas" />
                </div>
              ) : null}
            </section>
          </div>

          {siteUrl ? (
            <section className={card} aria-labelledby="h-enlaces">
              <h2 id="h-enlaces" className="font-display text-[18px] font-semibold text-foreground">
                Sabe exactamente de dónde llegan
              </h2>
              <p className="mt-1 mb-4 text-[14px] text-muted-foreground">
                Instagram y WhatsApp casi nunca dicen de dónde viene la visita. Usa estos enlaces en tu biografía y en tus mensajes y aquí saldrán con
                su nombre.
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-[13.5px] text-foreground">Para Instagram</p>
                  <CopyLink url={`${siteUrl}?utm_source=instagram`} message="Mira nuestra página:" />
                </div>
                <div>
                  <p className="mb-2 text-[13.5px] text-foreground">Para WhatsApp</p>
                  <CopyLink url={`${siteUrl}?utm_source=whatsapp`} message="Mira nuestra página:" />
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      {r.store ? (
        <section className={card} aria-labelledby="h-tienda">
          <h2 id="h-tienda" className="mb-4 font-display text-[18px] font-semibold text-foreground">
            Tienda en línea
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[13px] text-muted-foreground">Pedidos</p>
              <p className="font-display text-[26px] font-bold text-foreground">{fmt(r.store.orders)}</p>
              <p className="text-[12.5px] text-muted-foreground">{change(r.store.orders, r.store.previous.orders)?.text ?? ' '}</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground">Ventas (sin cancelados)</p>
              <p className="font-display text-[26px] font-bold text-foreground">{cop(r.store.sales)}</p>
              <p className="text-[12.5px] text-muted-foreground">{change(r.store.sales, r.store.previous.sales)?.text ?? ' '}</p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
