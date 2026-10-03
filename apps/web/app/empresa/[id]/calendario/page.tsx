import type { Metadata } from 'next';
import Link from 'next/link';
import { deleteEventAction } from '@/app/empresa/calendar-actions';
import { NewEventPanel } from '@/components/calendar-forms';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { KIND_HUE, KIND_LABEL, WEEKDAYS, dayOf, monthGrid, monthTitle, onDay, timeOf, type CalendarItem } from '@/lib/calendar';
import { atLeast } from '@/lib/companies';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Calendario — 3R' };

const dayTitle = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function Chip({ item }: { item: CalendarItem }) {
  const hue = KIND_HUE[item.kind] ?? 275;
  return (
    <span
      className="block truncate rounded-md px-1.5 py-0.5 text-[11.5px] leading-snug"
      style={{ backgroundColor: `oklch(0.75 0.15 ${hue} / 0.16)`, color: `oklch(0.88 0.08 ${hue})` }}
      title={item.title}
    >
      {item.allDay ? '' : `${timeOf(item.start)} `}
      {item.title}
    </span>
  );
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string; dia?: string }>;
}) {
  const { id } = await params;
  const { mes, dia } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'calendar')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Calendario"
        text="Reuniones, eventos, vacaciones, cumpleaños y vencimientos de la empresa en un solo calendario."
      />
    );
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const [y, m] = (/^\d{4}-\d{2}$/.test(mes ?? '') ? mes! : today.slice(0, 7)).split('-').map(Number);
  const grid = monthGrid(y, m);
  const { data: items } = await authedApi<CalendarItem[]>(`/companies/${id}/calendar?from=${grid.from}&to=${grid.to}`);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const thisMonth = `${y}-${String(m).padStart(2, '0')}`;
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(dia ?? '') ? dia! : null;
  // Agenda: el día elegido, o lo que queda del mes (todo el mes si no es el actual).
  const agendaDays = selected
    ? [selected]
    : grid.days.filter((d) => d >= grid.first && d <= grid.last && (thisMonth !== today.slice(0, 7) || d >= today));
  const agenda = agendaDays.map((d) => ({ day: d, items: items.filter((i) => onDay(i, d)) })).filter((g) => g.items.length > 0);
  const base = `/empresa/${id}/calendario`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link
            href={`${base}?mes=${prev}`}
            aria-label="Mes anterior"
            className="rounded-full border border-white/[0.12] px-3.5 py-2 text-[14px] hover:bg-white/[0.06]"
          >
            ←
          </Link>
          <h2 className="min-w-[190px] text-center font-display text-[20px] font-semibold text-foreground">{monthTitle(y, m)}</h2>
          <Link
            href={`${base}?mes=${next}`}
            aria-label="Mes siguiente"
            className="rounded-full border border-white/[0.12] px-3.5 py-2 text-[14px] hover:bg-white/[0.06]"
          >
            →
          </Link>
          {thisMonth !== today.slice(0, 7) ? (
            <Link href={base} className="ml-1 text-[13.5px] text-muted-foreground hover:text-foreground">
              Hoy
            </Link>
          ) : null}
        </div>
        <NewEventPanel
          companyId={id}
          canTeam={atLeast(company.me.role, 'supervisor')}
          defaultDate={selected ?? (thisMonth === today.slice(0, 7) ? today : grid.first)}
        />
      </div>

      <div className="hidden overflow-hidden rounded-[24px] border border-white/[0.08] bg-card sm:block">
        <div className="grid grid-cols-7 border-b border-white/[0.06]">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-2 text-center text-[12.5px] text-muted-foreground">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.days.map((d) => {
            const inMonth = d >= grid.first && d <= grid.last;
            const dayItems = items.filter((i) => onDay(i, d));
            const isToday = d === today;
            return (
              <Link
                key={d}
                href={`${base}?mes=${thisMonth}&dia=${d}`}
                aria-label={`${dayTitle.format(new Date(`${d}T12:00:00Z`))}: ${dayItems.length} ${dayItems.length === 1 ? 'cosa' : 'cosas'}`}
                className={`min-h-[104px] border-b border-r border-white/[0.05] p-1.5 transition hover:bg-white/[0.03] ${inMonth ? '' : 'opacity-40'} ${selected === d ? 'bg-primary/[0.08]' : ''}`}
              >
                <span
                  className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-[12.5px] ${isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground'}`}
                >
                  {Number(d.slice(8))}
                </span>
                <span className="block space-y-0.5">
                  {dayItems.slice(0, 3).map((i) => (
                    <Chip key={`${i.id}-${d}`} item={i} />
                  ))}
                  {dayItems.length > 3 ? <span className="block px-1 text-[11px] text-muted-foreground">+{dayItems.length - 3} más</span> : null}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <section aria-labelledby="h-agenda" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 id="h-agenda" className="font-display text-[18px] font-semibold text-foreground">
            {selected ? <span className="first-letter:uppercase">{dayTitle.format(new Date(`${selected}T12:00:00Z`))}</span> : 'Agenda'}
          </h3>
          {selected ? (
            <Link href={`${base}?mes=${thisMonth}`} className="text-[13.5px] text-muted-foreground hover:text-foreground">
              Ver todo el mes
            </Link>
          ) : null}
        </div>
        {agenda.length === 0 ? (
          <p className="rounded-[24px] border border-dashed border-white/[0.12] px-6 py-10 text-center text-muted-foreground">
            {selected ? 'Nada para este día.' : 'Nada en lo que queda del mes.'}
          </p>
        ) : (
          <ol className="space-y-5">
            {agenda.map((g) => (
              <li key={g.day}>
                <p className={`text-[13px] first-letter:uppercase ${g.day === today ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {g.day === today ? 'Hoy · ' : ''}
                  {dayTitle.format(new Date(`${g.day}T12:00:00Z`))}
                </p>
                <ul className="mt-2 space-y-2">
                  {g.items.map((i) => {
                    const hue = KIND_HUE[i.kind] ?? 275;
                    const multi = i.end && dayOf(i.end, i.allDay) !== dayOf(i.start, i.allDay);
                    const body = (
                      <>
                        <span
                          className="mt-1.5 size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: `oklch(0.75 0.15 ${hue})` }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] text-foreground">{i.title}</span>
                          <span className="block text-[12.5px] text-muted-foreground">
                            {[
                              KIND_LABEL[i.kind] ?? i.kind,
                              i.allDay
                                ? multi
                                  ? `hasta el ${dayTitle.format(new Date(`${dayOf(i.end!, true)}T12:00:00Z`))}`
                                  : 'todo el día'
                                : `${timeOf(i.start)}${i.end ? ` a ${timeOf(i.end)}` : ''}`,
                              i.location,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                          {i.description ? <span className="mt-1 block text-[13.5px] text-foreground/80">{i.description}</span> : null}
                        </span>
                      </>
                    );
                    return (
                      <li key={`${i.id}-${g.day}`} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-card px-4 py-3">
                        {i.href ? (
                          <Link href={`/empresa/${id}/${i.href}`} className="flex min-w-0 flex-1 items-start gap-3 hover:underline">
                            {body}
                          </Link>
                        ) : (
                          <span className="flex min-w-0 flex-1 items-start gap-3">{body}</span>
                        )}
                        {i.source === 'event' && i.can?.edit ? (
                          <form action={deleteEventAction}>
                            <input type="hidden" name="companyId" value={id} />
                            <input type="hidden" name="eventId" value={i.id} />
                            <button type="submit" className="text-[12.5px] text-muted-foreground transition hover:text-[#ffb4b5]">
                              Borrar
                            </button>
                          </form>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
