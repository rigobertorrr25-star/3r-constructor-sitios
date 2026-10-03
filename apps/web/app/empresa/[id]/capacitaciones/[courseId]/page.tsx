import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { archiveCourseAction, deleteCourseAction, publishCourseAction } from '@/app/empresa/training-actions';
import { CourseProgressBar } from '@/components/course-progress-bar';
import { CourseQuiz } from '@/components/course-quiz';
import { authedApi } from '@/lib/api';
import { STATUS_LABEL, dayText, type Course } from '@/lib/training';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Curso — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' });
const ghost = 'rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground hover:bg-white/[0.06]';

export default async function CoursePage({ params }: { params: Promise<{ id: string; courseId: string }> }) {
  const { id, courseId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<Course>(`/companies/${id}/training/${courseId}`);
  if (res.status === 404 || res.status === 403) notFound();
  const c = res.data;
  const base = `/empresa/${id}/capacitaciones`;
  const done = new Set(c.mine?.lessonsDone ?? []);
  const next = c.lessons.find((l) => !done.has(l.id));
  const completed = !!c.mine?.completedAt;
  const quizTime = c.status === 'published' && !completed && !next && c.questions.length > 0;
  const hidden = (
    <>
      <input type="hidden" name="companyId" value={id} />
      <input type="hidden" name="courseId" value={c.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Link href={base} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Capacitaciones
      </Link>
      <div>
        <p className="text-[14px] text-muted-foreground">
          {[
            c.required ? 'Obligatorio' : 'Curso',
            `${c.lessons.length} ${c.lessons.length === 1 ? 'lección' : 'lecciones'}`,
            c.questions.length ? `evaluación de ${c.questions.length} preguntas` : null,
            c.dueAt ? `hasta el ${dayText(c.dueAt)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          {c.overdue ? <span className="text-[#ffb4b5]"> · vencido</span> : null}
        </p>
        <h2 className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{c.title}</h2>
        {c.description ? <p className="mt-2 max-w-2xl text-[15px] text-foreground/85">{c.description}</p> : null}
      </div>

      <div className={`grid gap-6 ${c.can.manage || c.can.seeTeam ? 'lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start' : ''}`}>
        <div className="space-y-6">
          {completed ? (
            <section className="rounded-[28px] border border-[#5ee0a0]/30 bg-[#5ee0a0]/[0.07] p-6" aria-label="Curso terminado">
              <p className="font-display text-[19px] font-semibold text-foreground">Terminaste este curso</p>
              <p className="mt-1 text-[14.5px] text-foreground/85">
                El {when.format(new Date(c.mine!.completedAt!))}
                {c.questions.length && c.mine?.score != null ? ` · evaluación: ${c.mine.score} %` : ''}
              </p>
              <a
                href={`${base}/${c.id}/certificado`}
                className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
              >
                Descargar certificado (PDF)
              </a>
            </section>
          ) : c.status === 'published' ? (
            <section className={card} aria-label="Tu avance">
              <div className="flex items-center justify-between gap-3 text-[14px]">
                <span className="text-foreground">Tu avance</span>
                <span className="text-muted-foreground">
                  {c.mine?.done ?? 0} de {c.lessons.length} lecciones
                </span>
              </div>
              <div className="mt-3">
                <CourseProgressBar done={c.mine?.done ?? 0} total={c.lessons.length} />
              </div>
              {next ? (
                <Link
                  href={`${base}/${c.id}/leccion/${next.id}`}
                  className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
                >
                  {c.mine ? `Seguir: ${next.title}` : 'Empezar el curso'}
                </Link>
              ) : null}
            </section>
          ) : (
            <p className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[14px] text-muted-foreground">
              {c.status === 'draft' ? 'Vista previa: el equipo todavía no lo ve. Publícalo cuando esté listo.' : 'Este curso está archivado.'}
            </p>
          )}

          <section className={card} aria-labelledby="h-lecciones">
            <h3 id="h-lecciones" className="mb-3 font-display text-[18px] font-semibold text-foreground">
              Lecciones
            </h3>
            <ol className="divide-y divide-white/[0.06]">
              {c.lessons.map((l, i) => (
                <li key={l.id}>
                  <Link
                    href={`${base}/${c.id}/leccion/${l.id}`}
                    className="flex items-center gap-3 py-3 text-[15px] text-foreground transition hover:text-primary"
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] ${
                        done.has(l.id) ? 'bg-[#5ee0a0]/20 text-[#9df0c6]' : 'border border-white/[0.12] text-muted-foreground'
                      }`}
                      aria-label={done.has(l.id) ? 'Vista' : 'Sin ver'}
                    >
                      {done.has(l.id) ? '✓' : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">{l.title}</span>
                    {l.videoUrl ? <span className="text-[12.5px] text-muted-foreground">video</span> : null}
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {quizTime ? (
            <section className={card} aria-labelledby="h-evaluacion">
              <h3 id="h-evaluacion" className="mb-3 font-display text-[18px] font-semibold text-foreground">
                Evaluación final
              </h3>
              <CourseQuiz companyId={id} courseId={c.id} questions={c.questions} passScore={c.passScore} />
            </section>
          ) : c.questions.length && !completed && c.status === 'published' ? (
            <p className="text-[14px] text-muted-foreground">Al terminar las lecciones se abre la evaluación final ({c.passScore} % para aprobar).</p>
          ) : null}
        </div>

        {c.can.manage || c.can.seeTeam ? (
          <aside className="space-y-6">
            <section className={card} aria-labelledby="h-gestion">
              <h3 id="h-gestion" className="font-display text-[18px] font-semibold text-foreground">
                {STATUS_LABEL[c.status]}
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {c.status !== 'draft' ? (
                  <Link
                    href={`${base}/${c.id}/equipo`}
                    className="rounded-full bg-primary px-4 py-2 text-[13.5px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
                  >
                    Avance del equipo
                  </Link>
                ) : null}
                {c.can.manage ? (
                  <>
                    <Link href={`${base}/${c.id}/editar`} className={ghost}>
                      Editar
                    </Link>
                    {c.status === 'published' ? (
                      <form action={archiveCourseAction}>
                        {hidden}
                        <button type="submit" className={ghost}>
                          Archivar
                        </button>
                      </form>
                    ) : (
                      <form action={publishCourseAction}>
                        {hidden}
                        <button
                          type="submit"
                          className="rounded-full border border-primary/50 px-4 py-2 text-[13.5px] text-foreground hover:bg-primary/10"
                        >
                          {c.status === 'draft' ? 'Publicar' : 'Publicar de nuevo'}
                        </button>
                      </form>
                    )}
                  </>
                ) : null}
              </div>
              {c.status === 'draft' && c.can.manage ? (
                <p className="mt-3 text-[13px] text-muted-foreground">Al publicarlo, le llega un aviso a todo el equipo.</p>
              ) : null}
              {c.can.manage && c.questions.length ? (
                <p className="mt-3 text-[13px] text-muted-foreground">Para aprobar: {c.passScore} % de respuestas correctas.</p>
              ) : null}
            </section>
            {c.can.manage ? (
              <form action={deleteCourseAction}>
                {hidden}
                <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                  Borrar este curso (y el avance de todos)
                </button>
              </form>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
