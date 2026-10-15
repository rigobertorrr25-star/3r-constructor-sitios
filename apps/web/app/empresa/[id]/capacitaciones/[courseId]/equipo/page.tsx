import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CourseProgressBar } from '@/components/course-progress-bar';
import { authedApi } from '@/lib/api';
import type { TeamProgress } from '@/lib/training';
import { loadCompany } from '../../../company';

export const metadata: Metadata = { title: 'Avance del equipo — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const short = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const STATUS = { pending: 'Sin empezar', in_progress: 'En curso', completed: 'Terminó' } as const;

export default async function CourseTeamPage({ params }: { params: Promise<{ id: string; courseId: string }> }) {
  const { id, courseId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<TeamProgress>(`/companies/${id}/training/${courseId}/team`);
  if (!res.ok) notFound();
  const { course: c, people } = res.data;
  const base = `/empresa/${id}/capacitaciones/${c.id}`;
  const count = (s: keyof typeof STATUS) => people.filter((p) => p.status === s).length;

  return (
    <div className="space-y-6">
      <Link href={base} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← {c.title}
      </Link>
      <div>
        <p className="text-[14px] text-muted-foreground">Avance del equipo</p>
        <h2 className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{c.title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {(['completed', 'in_progress', 'pending'] as const).map((s) => (
          <div key={s} className={card}>
            <p className="text-[13px] text-muted-foreground">{STATUS[s]}</p>
            <p className="mt-1 font-display text-[28px] font-bold text-foreground">{count(s)}</p>
            <p className="text-[13px] text-muted-foreground">de {people.length} personas</p>
          </div>
        ))}
      </div>
      <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
        {people.map((p) => (
          <li key={p.memberId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-foreground">{p.name}</span>
              <span className="block text-[12.5px] text-muted-foreground">{[p.jobTitle, p.area].filter(Boolean).join(' · ') || 'Sin cargo'}</span>
            </span>
            <span className="w-full space-y-1.5 sm:w-56">
              <CourseProgressBar done={p.done} total={c.lessons} completed={p.status === 'completed'} />
              <span
                className={`block text-[12.5px] ${p.status === 'completed' ? 'text-[#9df0c6]' : p.overdue ? 'text-[#ffb4b5]' : 'text-muted-foreground'}`}
              >
                {p.status === 'completed'
                  ? `Terminó el ${short.format(new Date(p.completedAt!))}${c.questions && p.score != null ? ` · ${p.score} %` : ''}`
                  : `${STATUS[p.status]} · ${p.done} de ${c.lessons}${p.attempts ? ` · ${p.attempts} ${p.attempts === 1 ? 'intento' : 'intentos'}` : ''}${p.overdue ? ' · vencido' : ''}`}
              </span>
            </span>
            {p.status === 'completed' ? (
              <a href={`${base}/certificado?memberId=${p.memberId}`} className="w-fit text-[13px] text-foreground underline-offset-2 hover:underline">
                Certificado
              </a>
            ) : (
              <span className="hidden w-[72px] sm:block" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
