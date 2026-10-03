import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { lessonDoneAction } from '@/app/empresa/training-actions';
import { authedApi } from '@/lib/api';
import type { Course } from '@/lib/training';
import { loadCompany } from '../../../../company';

export const metadata: Metadata = { title: 'Lección — 3R' };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function LessonPage({ params }: { params: Promise<{ id: string; courseId: string; lessonId: string }> }) {
  const { id, courseId, lessonId } = await params;
  if (!UUID.test(courseId) || !UUID.test(lessonId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<Course>(`/companies/${id}/training/${courseId}`);
  if (!res.ok) notFound();
  const c = res.data;
  const i = c.lessons.findIndex((l) => l.id === lessonId);
  if (i < 0) notFound();
  const l = c.lessons[i];
  const prev = c.lessons[i - 1];
  const next = c.lessons[i + 1];
  const seen = c.mine?.lessonsDone.includes(l.id);
  const course = `/empresa/${id}/capacitaciones/${c.id}`;
  const paragraphs = l.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const nav = 'rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]';

  return (
    <div className="space-y-6">
      <Link href={course} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← {c.title}
      </Link>
      <article className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)] sm:p-8">
        <p className="text-[13.5px] text-muted-foreground">
          Lección {i + 1} de {c.lessons.length}
          {seen ? <span className="text-[#9df0c6]"> · vista</span> : null}
        </p>
        <h2 className="mt-1 font-display text-[24px] font-bold tracking-tight text-foreground">{l.title}</h2>
        {l.videoUrl ? (
          <a
            href={l.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/[0.08] px-4 py-3 text-[14.5px] text-foreground transition hover:bg-primary/[0.14]"
          >
            ▶ Ver el video o material de esta lección
          </a>
        ) : null}
        <div className="mt-6 max-w-[68ch] space-y-4 text-[16px] leading-relaxed text-foreground/90">
          {paragraphs.map((p, k) => (
            <p key={k} className="whitespace-pre-wrap">
              {p}
            </p>
          ))}
        </div>
      </article>

      <div className="flex flex-wrap items-center gap-3">
        {prev ? (
          <Link href={`${course}/leccion/${prev.id}`} className={nav}>
            ← Anterior
          </Link>
        ) : null}
        {c.status === 'published' && !c.mine?.completedAt && !seen ? (
          <form action={lessonDoneAction} className="ml-auto">
            <input type="hidden" name="companyId" value={id} />
            <input type="hidden" name="courseId" value={c.id} />
            <input type="hidden" name="lessonId" value={l.id} />
            <input type="hidden" name="next" value={next?.id ?? ''} />
            <button
              type="submit"
              className="rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
            >
              {next ? 'Listo, siguiente lección' : c.questions.length ? 'Listo, ir a la evaluación' : 'Listo, terminar el curso'}
            </button>
          </form>
        ) : next ? (
          <Link href={`${course}/leccion/${next.id}`} className={`${nav} ml-auto`}>
            Siguiente →
          </Link>
        ) : (
          <Link href={course} className={`${nav} ml-auto`}>
            Volver al curso
          </Link>
        )}
      </div>
    </div>
  );
}
