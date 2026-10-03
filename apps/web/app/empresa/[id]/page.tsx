import type { Metadata } from 'next';
import Link from 'next/link';
import { whatsappLink } from '@/components/whatsapp-button';
import { KIND_LABEL as NEWS_KIND } from '@/lib/announcements';
import type { AnnouncementsSummary } from '@/lib/announcements';
import { authedApi } from '@/lib/api';
import { KIND_HUE, dayOf, timeOf, type CalendarItem } from '@/lib/calendar';
import { AREA_LABEL, MODULE_INFO, MODULE_ROUTE, atLeast, type ModuleArea } from '@/lib/companies';
import type { CrmSummary } from '@/lib/crm';
import type { DocumentsSummary } from '@/lib/documents';
import { monthName, todayBogota, type EmployeesSummary } from '@/lib/employees';
import { formatMoney } from '@/lib/orders';
import { TYPE_LABEL as LEAVE_LABEL, type RequestsSummary } from '@/lib/requests';
import type { SurveysSummary } from '@/lib/surveys';
import type { InventorySummary } from '@/lib/inventory';
import type { TrainingSummary } from '@/lib/training';
import type { TicketSummary } from '@/lib/tickets';
import { loadCompany } from './company';

export const metadata: Metadata = { title: 'Mi empresa — 3R' };

const AREAS: ModuleArea[] = ['empresa', 'clientes', 'web', 'automatizacion', 'ia'];
const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const dayShort = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

type Todo = { href: string; text: string; tone?: 'warn' };

const get = <T,>(on: boolean, path: string) => (on ? authedApi<T>(path).then((r) => (r.ok ? r.data : null)) : Promise.resolve(null));

export default async function CompanyHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  const role = company.me.role;
  const isAdmin = atLeast(role, 'admin');
  const enabled = (key: string) => company.modules.some((m) => m.key === key && m.enabled);
  const base = `/empresa/${id}`;
  const c = `/companies/${id}`;

  // Cada módulo activo aporta sus cifras y pendientes: el tablero crece con cada módulo.
  const [crm, tickets, people, requests, news, docs, upcoming, surveys, training, stock] = await Promise.all([
    get<CrmSummary>(enabled('crm'), `${c}/crm/summary`),
    get<TicketSummary>(enabled('tickets'), `${c}/tickets/summary`),
    get<EmployeesSummary>(enabled('employees'), `${c}/employees/summary`),
    get<RequestsSummary>(enabled('requests'), `${c}/requests/summary`),
    get<AnnouncementsSummary>(enabled('announcements'), `${c}/announcements/summary`),
    get<DocumentsSummary>(enabled('documents'), `${c}/documents/summary`),
    get<CalendarItem[]>(enabled('calendar'), `${c}/calendar/upcoming`),
    get<SurveysSummary>(enabled('surveys'), `${c}/surveys/summary`),
    get<TrainingSummary>(enabled('training'), `${c}/training/summary`),
    get<InventorySummary>(enabled('inventory'), `${c}/inventory/summary`),
  ]);

  const todos: Todo[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (requests?.toDecide)
    todos.push({ href: `${base}/solicitudes?view=to_decide`, text: `${plural(requests.toDecide, 'solicitud', 'solicitudes')} por decidir` });
  if (tickets?.mine) todos.push({ href: `${base}/tickets?view=mine`, text: `${plural(tickets.mine, 'ticket', 'tickets')} a tu cargo` });
  if (tickets?.urgent) todos.push({ href: `${base}/tickets`, text: `${plural(tickets.urgent, 'ticket urgente', 'tickets urgentes')}`, tone: 'warn' });
  if (tickets && atLeast(role, 'supervisor') && tickets.unassigned)
    todos.push({ href: `${base}/tickets`, text: `${plural(tickets.unassigned, 'ticket', 'tickets')} sin responsable` });
  if (surveys?.pendingToAnswer)
    todos.push({
      href: surveys.pendingToAnswer === 1 ? `${base}/encuestas/${surveys.pending[0].id}` : `${base}/encuestas`,
      text: `${plural(surveys.pendingToAnswer, 'encuesta', 'encuestas')} por responder`,
    });
  if (training?.pending)
    todos.push({
      href: training.pending === 1 ? `${base}/capacitaciones/${training.courses[0].id}` : `${base}/capacitaciones`,
      text: `${plural(training.pending, 'curso obligatorio', 'cursos obligatorios')} por terminar`,
      tone: training.courses.some((t) => t.overdue) ? 'warn' : undefined,
    });
  if (stock?.lowStock)
    todos.push({
      href: `${base}/inventario?filter=low`,
      text: `${plural(stock.lowStock, 'producto', 'productos')} con poco inventario`,
      tone: 'warn',
    });
  if (news?.unread) todos.push({ href: `${base}/comunicados`, text: `${plural(news.unread, 'comunicado', 'comunicados')} sin leer` });
  if (docs?.expiring.length)
    todos.push({ href: `${base}/documentos`, text: `${plural(docs.expiring.length, 'documento vence', 'documentos vencen')} pronto`, tone: 'warn' });
  if (people?.contractsEnding)
    todos.push({
      href: `${base}/personal`,
      text: `${plural(people.contractsEnding, 'contrato vence', 'contratos vencen')} en 30 días`,
      tone: 'warn',
    });
  if (people?.incompleteProfiles)
    todos.push({ href: `${base}/personal`, text: `${plural(people.incompleteProfiles, 'ficha incompleta', 'fichas incompletas')}` });
  if (requests?.myOpen)
    todos.push({ href: `${base}/solicitudes?view=mine`, text: `${plural(requests.myOpen, 'solicitud tuya', 'solicitudes tuyas')} en espera` });

  const stats: { label: string; value: string; href?: string }[] = [
    { label: 'Personas', value: String(company.memberCount), href: `${base}/${enabled('employees') ? 'personal' : 'equipo'}` },
    ...(requests && atLeast(role, 'supervisor')
      ? [{ label: 'Ausentes hoy', value: String(requests.absentToday.length), href: `${base}/solicitudes?view=all` }]
      : []),
    ...(people
      ? [{ label: `Cumpleaños en ${monthName(todayBogota().month)}`, value: String(people.birthdaysThisMonth), href: `${base}/personal` }]
      : []),
    ...(tickets ? [{ label: 'Tickets pendientes', value: String(tickets.active), href: `${base}/tickets` }] : []),
    ...(crm ? [{ label: 'Negocios abiertos', value: String(crm.openCount), href: `${base}/crm` }] : []),
    ...(crm ? [{ label: 'Valor en juego', value: formatMoney(crm.openValueCents, 'COP'), href: `${base}/crm` }] : []),
    ...(requests && !atLeast(role, 'supervisor')
      ? [{ label: 'Mis días de vacaciones este año', value: String(requests.myVacationDaysThisYear), href: `${base}/solicitudes` }]
      : []),
  ];
  const today = todayBogota().iso;
  const activeModules = company.modules.filter((m) => m.enabled).length;

  return (
    <div className="space-y-10">
      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.slice(0, 8).map((s) => (
          <li key={s.label}>
            <Link
              href={s.href ?? base}
              className="block h-full rounded-[24px] border border-white/[0.08] bg-card p-5 transition hover:border-white/[0.16]"
            >
              <span className="block text-[13px] text-muted-foreground">{s.label}</span>
              <span className="mt-1 block font-display text-[24px] font-bold tracking-tight text-foreground sm:text-[28px]">{s.value}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={card} aria-labelledby="h-pendientes">
          <h2 id="h-pendientes" className="font-display text-[19px] font-semibold text-foreground">
            Pendientes
          </h2>
          {todos.length ? (
            <ul className="mt-4 divide-y divide-white/[0.06]">
              {todos.map((t) => (
                <li key={t.text}>
                  <Link
                    href={t.href}
                    className="flex items-center justify-between gap-3 py-3 text-[15px] text-foreground transition hover:text-primary"
                  >
                    <span className="flex items-center gap-3">
                      <span className={`size-2 shrink-0 rounded-full ${t.tone === 'warn' ? 'bg-[#ffd27a]' : 'bg-primary'}`} aria-hidden="true" />
                      {t.text}
                    </span>
                    <span aria-hidden="true" className="text-muted-foreground">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[15px] text-muted-foreground">
              {activeModules ? 'Todo al día. No tienes nada pendiente.' : 'Cuando la empresa active módulos, aquí verás lo que te toca hacer.'}
            </p>
          )}
        </section>

        {upcoming ? (
          <section className={card} aria-labelledby="h-proximos">
            <div className="flex items-center justify-between gap-3">
              <h2 id="h-proximos" className="font-display text-[19px] font-semibold text-foreground">
                Próximos días
              </h2>
              <Link href={`${base}/calendario`} className="text-[13.5px] text-muted-foreground hover:text-foreground">
                Calendario →
              </Link>
            </div>
            {upcoming.length ? (
              <ul className="mt-4 space-y-3">
                {upcoming.slice(0, 7).map((i) => {
                  const d = dayOf(i.start, i.allDay);
                  return (
                    <li key={`${i.source}-${i.id}`} className="flex items-start gap-3">
                      <span className="w-[84px] shrink-0 text-[13px] text-muted-foreground first-letter:uppercase">
                        {d === today ? 'Hoy' : dayShort.format(new Date(`${d}T12:00:00Z`))}
                      </span>
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: `oklch(0.75 0.15 ${KIND_HUE[i.kind] ?? 275})` }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 text-[14.5px] text-foreground">
                        {i.allDay ? '' : <span className="text-muted-foreground">{timeOf(i.start)} · </span>}
                        {i.title}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-[15px] text-muted-foreground">Nada en los próximos 14 días.</p>
            )}
          </section>
        ) : null}

        {requests && atLeast(role, 'supervisor') && requests.absentToday.length ? (
          <section className={card} aria-labelledby="h-ausentes">
            <h2 id="h-ausentes" className="font-display text-[19px] font-semibold text-foreground">
              Hoy no están
            </h2>
            <ul className="mt-4 space-y-2">
              {requests.absentToday.map((a, i) => (
                <li key={i} className="flex justify-between gap-3 text-[14.5px]">
                  <span className="text-foreground">{a.name}</span>
                  <span className="text-muted-foreground">{LEAVE_LABEL[a.type]}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {news?.latest ? (
          <Link href={`${base}/comunicados/${news.latest.id}`} className={`${card} block transition hover:border-white/[0.16]`}>
            <p className="text-[13px] text-muted-foreground">Último comunicado · {NEWS_KIND[news.latest.kind]}</p>
            <p className="mt-2 font-display text-[19px] font-semibold text-foreground">{news.latest.title}</p>
            <p className="mt-3 text-[13.5px] text-primary">Leerlo →</p>
          </Link>
        ) : null}
      </div>

      {isAdmin ? (
        <section aria-labelledby="h-modulos" className="space-y-8">
          <div>
            <h2 id="h-modulos" className="font-display text-[22px] font-semibold tracking-tight text-foreground">
              Módulos de tu empresa
            </h2>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              {activeModules} activos. Para activar uno, escríbenos: lo dejamos listo con tus datos.
            </p>
          </div>
          {AREAS.map((area) => {
            const modules = company.modules.filter((m) => m.area === area);
            return (
              <div key={area}>
                <h3 className="font-display text-[17px] font-semibold text-foreground">{AREA_LABEL[area]}</h3>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {modules.map((m) => {
                    const info = MODULE_INFO[m.key] ?? { name: m.key, text: '' };
                    return (
                      <li
                        key={m.key}
                        className="flex h-full flex-col rounded-[24px] border border-white/[0.08] bg-card p-5 shadow-[var(--shadow-glass)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-display text-[16.5px] font-semibold text-foreground">{info.name}</h4>
                          {m.enabled ? (
                            <span className="shrink-0 rounded-full bg-[#5ee0a0]/15 px-2.5 py-1 text-[12px] text-[#9df0c6]">Activo</span>
                          ) : !m.ready ? (
                            <span className="shrink-0 rounded-full bg-white/[0.05] px-2.5 py-1 text-[12px] text-muted-foreground">Muy pronto</span>
                          ) : null}
                        </div>
                        <p className="mt-2 flex-1 text-[14px] leading-snug text-muted-foreground">{info.text}</p>
                        {m.enabled && MODULE_ROUTE[m.key] ? (
                          <Link
                            href={`${base}/${MODULE_ROUTE[m.key]}`}
                            className="mt-4 inline-flex w-fit rounded-full bg-primary px-4 py-2 text-[13.5px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
                          >
                            Abrir
                          </Link>
                        ) : null}
                        {m.ready && !m.enabled ? (
                          <a
                            href={whatsappLink(`Hola, quiero activar el módulo ${info.name} para ${company.name}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex w-fit rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
                          >
                            Activarlo
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
