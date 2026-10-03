import type { Metadata } from 'next';
import Link from 'next/link';
import { CourseProgressBar } from '@/components/course-progress-bar';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { STATUS_LABEL, dayText, type CourseCard, type CourseList } from '@/lib/training';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Capacitaciones — 3R' };

function stateText(c: CourseCard) {
  if (c.mine?.completedAt) return c.questions && c.mine.score != null ? `Terminado · ${c.mine.score} %` : 'Terminado';
  if (!c.mine) return 'Sin empezar';
  if (c.mine.done >= c.lessons && c.questions) return 'Falta la evaluación';
  return `${c.mine.done} de ${c.lessons} lecciones`;
}

function Card({ c, base, manage }: { c: CourseCard; base: string; manage: boolean }) {
  const done = !!c.mine?.completedAt;
  return (
    <li>
      <Link
        href={`${base}/${c.id}`}
        className="flex h-full flex-col gap-3 rounded-[24px] border border-white/[0.08] bg-card p-5 shadow-[var(--shadow-glass)] transition hover:border-white/[0.16]"
      >
        <span className="flex flex-wrap gap-1.5">
          {c.required ? <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[12px] text-foreground">Obligatorio</span> : null}
          {c.overdue ? <span className="rounded-full bg-[#ff6b6e]/15 px-2.5 py-0.5 text-[12px] text-[#ffb4b5]">Vencido</span> : null}
          {manage && c.status !== 'published' ? (
            <span className="rounded-full border border-white/[0.1] px-2.5 py-0.5 text-[12px] text-muted-foreground">{STATUS_LABEL[c.status]}</span>
          ) : null}
        </span>
        <span className="font-display text-[17px] font-semibold leading-snug text-foreground">{c.title}</span>
        {c.description ? <span className="line-clamp-2 text-[14px] text-muted-foreground">{c.description}</span> : null}
        <span className="mt-auto space-y-2 pt-2">
          <span className="block text-[12.5px] text-muted-foreground">
            {[
              `${c.lessons} ${c.lessons === 1 ? 'lección' : 'lecciones'}`,
              c.questions ? 'con evaluación' : null,
              c.dueAt ? `hasta el ${dayText(c.dueAt)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {c.status === 'published' || done ? (
            <>
              <CourseProgressBar done={c.mine?.done ?? 0} total={c.lessons} completed={done} />
              <span className={`block text-[13px] ${done ? 'text-[#9df0c6]' : 'text-foreground/85'}`}>{stateText(c)}</span>
            </>
          ) : null}
          {c.stats ? (
            <span className="block text-[12.5px] text-muted-foreground">
              Equipo: {c.stats.completed} de {c.stats.members} lo terminaron
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'training')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Capacitaciones"
        text="Cursos para tu equipo con lecciones, videos y una evaluación al final. Ves quién avanzó y cada persona descarga su certificado."
      />
    );
  }
  const { data } = await authedApi<CourseList>(`/companies/${id}/training`);
  const base = `/empresa/${id}/capacitaciones`;
  const todo = data.courses.filter((c) => c.status === 'published' && c.required && !c.mine?.completedAt);
  const active = data.courses.filter((c) => c.status !== 'archived');
  const archived = data.courses.filter((c) => c.status === 'archived');

  return (
    <div className="space-y-8">
      {todo.length ? (
        <section className="rounded-[28px] border border-primary/30 bg-primary/[0.07] p-6" aria-labelledby="h-pendientes">
          <h2 id="h-pendientes" className="font-display text-[19px] font-semibold text-foreground">
            Te falta terminar
          </h2>
          <ul className="mt-3 space-y-2">
            {todo.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/${c.id}`} className="text-[15px] text-foreground underline-offset-2 hover:underline">
                  {c.title}
                  {c.dueAt ? <span className={c.overdue ? 'text-[#ffb4b5]' : 'text-muted-foreground'}> · hasta el {dayText(c.dueAt)}</span> : null} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.manage ? (
        <Link
          href={`${base}/nuevo`}
          className="inline-flex rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
        >
          + Nuevo curso
        </Link>
      ) : null}

      {active.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          {data.manage ? 'Todavía no hay cursos. Crea el primero: hay una plantilla de inducción para personal nuevo.' : 'No hay cursos por ahora.'}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((c) => (
            <Card key={c.id} c={c} base={base} manage={data.manage} />
          ))}
        </ul>
      )}

      {archived.length ? (
        <section className="space-y-3" aria-labelledby="h-archivados">
          <h2 id="h-archivados" className="font-display text-[17px] font-semibold text-foreground">
            Archivados
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {archived.map((c) => (
              <Card key={c.id} c={c} base={base} manage={data.manage} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
