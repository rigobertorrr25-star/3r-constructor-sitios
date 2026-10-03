import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SurveyForm } from '@/components/survey-form';
import { rawApi } from '@/lib/api';
import type { PublicSurvey } from '@/lib/surveys';

export const metadata: Metadata = { title: 'Encuesta', robots: { index: false, follow: false } };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)] sm:p-8';

/** Lo que ve el cliente desde el enlace: la encuesta para responder sin crear cuenta. */
export default async function PublicSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const res = await rawApi<PublicSurvey>(`/public/surveys/${token}`).catch(() => null);
  if (!res || !res.ok) notFound();
  const s = res.data;

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-8 sm:py-14">
      <header>
        <p className="text-[14px] text-muted-foreground">{s.company}</p>
        <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight text-foreground sm:text-[34px]">{s.title}</h1>
        {s.description ? <p className="mt-3 text-[15.5px] text-foreground/85">{s.description}</p> : null}
      </header>
      <section className={`${card} mt-8`} aria-label="Preguntas">
        {s.open ? (
          <SurveyForm questions={s.questions} token={token} />
        ) : (
          <p className="text-[15px] text-foreground/90">Esta encuesta ya se cerró. ¡Gracias por tu interés!</p>
        )}
      </section>
      <p className="mt-6 text-center text-[12.5px] text-muted-foreground">Tus respuestas solo las ve {s.company}.</p>
    </main>
  );
}
