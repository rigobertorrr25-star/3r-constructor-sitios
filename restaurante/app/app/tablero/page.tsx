import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { getDashboard, isValidScope, type Level } from '@/lib/dashboard';
import { todayIn } from '@/lib/finance';
import { formatCop } from '@/lib/format';
import { periodRange } from '@/lib/periods';
import { listLocations } from '@/lib/store';
import { formatQuantity, type Unit } from '@/lib/units';
import { AutoRefresh } from '@/components/auto-refresh';
import { PageTitle, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

const PERIODS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'ayer', label: 'Ayer' },
  { key: '7d', label: 'Últimos 7 días' },
  { key: 'mes', label: 'Este mes' },
];

// Estado: color + ícono + palabra (nunca solo el color).
const LEVEL: Record<Level, { label: string; icon: string; cls: string }> = {
  ok: { label: 'Normal', icon: '✓', cls: 'bg-success/15 text-success' },
  watch: { label: 'Revisar', icon: '!', cls: 'bg-warning/15 text-warning' },
  alert: { label: 'Alerta', icon: '▲', cls: 'bg-destructive/15 text-[#ffb4b5]' },
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string; sede?: string }> }) {
  const staff = await requireStaff('finance.view');
  const sp = await searchParams;
  const period = PERIODS.some((p) => p.key === sp.periodo) ? sp.periodo! : 'hoy';
  const today = todayIn(staff.timezone);
  const range = periodRange(period, today);
  const isOwner = staff.role === 'owner';
  const locations = isOwner && staff.locationCount > 1 ? await listLocations(staff.businessId, { activeOnly: true }) : [];
  const sede = isOwner && isValidScope(sp.sede) ? (sp.sede ?? (staff.locationCount > 1 ? 'all' : staff.locationId)) : staff.locationId;
  const d = await getDashboard(staff, { ...range, locationId: sede }, staff.timezone);
  const st = d.statement;
  const scoreLevel: Level = d.score >= 85 ? 'ok' : d.score >= 60 ? 'watch' : 'alert';
  const link = (patch: Record<string, string>) => `/app/tablero?${new URLSearchParams({ periodo: period, ...(isOwner && sede ? { sede } : {}), ...patch })}`;
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={60_000} />
      <PageTitle title="Control total" text={`${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)} · ${sede === 'all' ? 'Todas las sedes' : (locations.find((l) => l.id === sede)?.name ?? staff.locationName)}`} />
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <Link key={p.key} href={link({ periodo: p.key })} className={`rounded-full px-4 py-1.5 text-[14px] ${period === p.key ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground hover:text-foreground'}`}>
            {p.label}
          </Link>
        ))}
        {locations.length
          ? [{ id: 'all', name: 'Todas las sedes' }, ...locations].map((l) => (
              <Link key={l.id} href={link({ sede: l.id })} className={`rounded-full px-3.5 py-1.5 text-[13.5px] ${sede === l.id ? 'bg-white/[0.1] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {l.name}
              </Link>
            ))
          : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ventas" value={formatCop(st.sales)} hint={`${st.tables} mesas cobradas · ticket ${formatCop(st.averageTicket)}`} accent="#5ee0a0" />
        <Kpi label="Costo de productos" value={formatCop(st.costOfSales)} hint={st.sales ? `${Math.round((st.costOfSales / st.sales) * 100)} % de las ventas` : 'Según las recetas'} accent="#ff86db" />
        <Kpi label="Utilidad operativa" value={formatCop(st.operatingProfit)} hint="Después de mermas, faltantes y gastos" accent="#8a9bff" />
        <Kpi
          label="Caja esperada"
          value={d.expectedCash === null ? 'Cerrada' : formatCop(d.expectedCash)}
          hint={`${d.openTables} ${d.openTables === 1 ? 'mesa abierta' : 'mesas abiertas'} · ${formatCop(d.openTablesValue)} por cobrar`}
          accent="#d6b0ff"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[19px] font-bold">Radar de fugas</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold ${LEVEL[scoreLevel].cls}`}>
              <span aria-hidden="true">{LEVEL[scoreLevel].icon}</span> Índice {d.score}/100
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">Empieza en 100 y baja con cada señal de posible pérdida de plata o de mercancía.</p>
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {d.signals.map((s) => {
              const lv = LEVEL[s.level];
              const body = (
                <div className={`flex items-start justify-between gap-3 rounded-xl px-2 py-2.5 ${s.level === 'alert' ? 'bg-destructive/[0.06]' : ''}`}>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-medium">{s.title}</span>
                    <span className="block text-[12.5px] text-muted-foreground">{s.detail}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[14px] font-semibold">{s.value}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${lv.cls}`}>
                      <span aria-hidden="true">{lv.icon}</span> {lv.label}
                    </span>
                  </span>
                </div>
              );
              return (
                <li key={s.key}>
                  {s.link ? (
                    <Link href={s.link} className="block transition hover:bg-white/[0.02]">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-5">
          <section className={card}>
            <h2 className="font-display text-[18px] font-bold">Lo más vendido</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {d.topByStation.map((t) => (
                <div key={t.station}>
                  <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t.station === 'kitchen' ? 'Cocina' : 'Barra'}</h3>
                  {t.items.length === 0 ? <p className="mt-1 text-[14px] text-muted-foreground">Nada todavía.</p> : null}
                  <ol className="mt-1.5 space-y-1 text-[14px]">
                    {t.items.map((i, n) => (
                      <li key={i.name} className="flex justify-between gap-3">
                        <span>
                          {n + 1}. {i.name}
                        </span>
                        <span className="font-semibold">{i.quantity}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
          <section className={card}>
            <h2 className="font-display text-[18px] font-bold">Tiempos de preparación</h2>
            <ul className="mt-3 space-y-1.5 text-[14px]">
              {d.prep.map((p) => (
                <li key={p.station} className="flex justify-between">
                  <span className="text-muted-foreground">{p.station === 'kitchen' ? 'Cocina' : 'Barra'}</span>
                  <span>{p.avgMinutes === null ? '—' : `${p.avgMinutes} min promedio · ${p.tickets} comandas`}</span>
                </li>
              ))}
            </ul>
          </section>
          {d.lowStock.length ? (
            <section className={`${card} border-warning/40`}>
              <h2 className="font-display text-[18px] font-bold">Por comprar</h2>
              <ul className="mt-3 space-y-1 text-[14px]">
                {d.lowStock.map((l) => (
                  <li key={l.name} className="flex justify-between gap-3">
                    <span>{l.name}</span>
                    <span className="text-warning">
                      {formatQuantity(l.stock, l.unit as Unit)} de {formatQuantity(l.minStock, l.unit as Unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-card p-4" style={{ boxShadow: `inset 3px 0 0 ${accent}` }}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-[23px] font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
