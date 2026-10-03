import type { Metadata } from 'next';
import Link from 'next/link';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/companies';
import { birthdayText, monthName, personName, todayBogota, type DirectoryEntry, type EmployeesSummary } from '@/lib/employees';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Portal del empleado — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';

export default async function PeoplePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  const { q = '' } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'employees')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Portal del empleado"
        text="Con el portal, cada empleado tiene su ficha (documento, contacto de emergencia, EPS, contrato) y todo el equipo ve el directorio y los cumpleaños del mes."
      />
    );
  }

  const [{ data: people }, { data: summary }] = await Promise.all([
    authedApi<DirectoryEntry[]>(`/companies/${id}/employees`),
    authedApi<EmployeesSummary>(`/companies/${id}/employees/summary`),
  ]);
  const today = todayBogota();
  const month = String(today.month).padStart(2, '0');
  const birthdays = people.filter((p) => p.birthday?.startsWith(month)).sort((a, b) => a.birthday!.localeCompare(b.birthday!));
  const anniversaries = people
    .filter((p) => p.hiredAt && p.hiredAt.slice(5, 7) === month && Number(p.hiredAt.slice(0, 4)) < Number(today.iso.slice(0, 4)))
    .sort((a, b) => a.hiredAt!.slice(5).localeCompare(b.hiredAt!.slice(5)));
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? people.filter((p) => [personName(p.user), p.user.email, p.jobTitle, p.area].some((x) => x?.toLowerCase().includes(needle)))
    : people;

  const stats: [string, string][] = [
    ['Personas', String(summary.people)],
    [`Cumpleaños en ${monthName(today.month)}`, String(summary.birthdaysThisMonth)],
    ...(summary.incompleteProfiles !== undefined
      ? ([
          ['Fichas incompletas', String(summary.incompleteProfiles)],
          ['Contratos que vencen en 30 días', String(summary.contractsEnding)],
        ] as [string, string][])
      : []),
  ];

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-[24px] border border-white/[0.08] bg-card p-5">
            <dt className="text-[13px] text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {summary.incompleteProfiles ? (
        <p className="-mt-5 text-[13px] text-muted-foreground">Una ficha está incompleta si le falta el documento o el contacto de emergencia.</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-primary/30 bg-primary/[0.07] p-6">
        <div>
          <h2 className="font-display text-[19px] font-semibold text-foreground">Tu ficha</h2>
          <p className="mt-1 text-[14.5px] text-muted-foreground">Tus datos, tu contacto de emergencia, tu EPS y tu contrato, en un solo lugar.</p>
        </div>
        <Link
          href={`/empresa/${id}/personal/${company.me.memberId}`}
          className="inline-flex rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
        >
          Ver mi ficha
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card} aria-labelledby="h-cumple">
          <h2 id="h-cumple" className="font-display text-[18px] font-semibold text-foreground">
            Cumpleaños de {monthName(today.month)}
          </h2>
          {birthdays.length ? (
            <ul className="mt-4 space-y-3">
              {birthdays.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span className="text-[15px] text-foreground">{personName(p.user)}</span>
                  <span className={`text-[13.5px] ${p.birthday === today.mmdd ? 'font-medium text-[#9df0c6]' : 'text-muted-foreground'}`}>
                    {p.birthday === today.mmdd ? '¡Hoy!' : birthdayText(p.birthday!)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted-foreground">Nadie cumple años este mes, o todavía no han puesto su fecha en la ficha.</p>
          )}
        </section>
        <section className={card} aria-labelledby="h-aniv">
          <h2 id="h-aniv" className="font-display text-[18px] font-semibold text-foreground">
            Aniversarios en la empresa
          </h2>
          {anniversaries.length ? (
            <ul className="mt-4 space-y-3">
              {anniversaries.map((p) => {
                const years = Number(today.iso.slice(0, 4)) - Number(p.hiredAt!.slice(0, 4));
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <span className="text-[15px] text-foreground">{personName(p.user)}</span>
                    <span className="text-[13.5px] text-muted-foreground">
                      {years} {years === 1 ? 'año' : 'años'} · {birthdayText(p.hiredAt!.slice(5))}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted-foreground">Nadie cumple años en la empresa este mes.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="h-directorio" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="h-directorio" className="font-display text-[22px] font-semibold tracking-tight text-foreground">
            Directorio
          </h2>
          <form className="flex w-full max-w-sm gap-2" role="search">
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre, cargo o área…"
              aria-label="Buscar en el directorio"
              className="w-full rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-[14.5px] text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            />
            <button type="submit" className="shrink-0 rounded-full border border-white/[0.12] px-4 py-2.5 text-[14px] hover:bg-white/[0.06]">
              Buscar
            </button>
          </form>
        </div>
        {shown.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
            Nadie coincide con esa búsqueda.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <li key={p.id} className="flex flex-col rounded-[24px] border border-white/[0.08] bg-card p-5">
                <p className="text-[16px] font-semibold text-foreground">{personName(p.user)}</p>
                <p className="text-[13.5px] text-muted-foreground">{[p.jobTitle, p.area].filter(Boolean).join(' · ') || ROLE_LABEL[p.role]}</p>
                <p className="mt-3 break-all text-[13.5px] text-foreground/90">
                  <a href={`mailto:${p.user.email}`} className="hover:text-foreground">
                    {p.user.email}
                  </a>
                </p>
                {p.phone ? <p className="text-[13.5px] text-foreground/90">{p.phone}</p> : null}
                {p.canView ? (
                  <Link
                    href={`/empresa/${id}/personal/${p.id}`}
                    className="mt-4 inline-flex w-fit rounded-full border border-white/[0.12] px-4 py-2 text-[13px] text-foreground transition hover:bg-white/[0.06]"
                  >
                    {p.id === company.me.memberId ? 'Mi ficha' : 'Ver ficha'}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
