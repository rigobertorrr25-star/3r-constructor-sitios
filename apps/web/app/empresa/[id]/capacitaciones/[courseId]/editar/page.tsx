import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CourseEditor } from '@/components/course-editor';
import { authedApi } from '@/lib/api';
import type { Course } from '@/lib/training';
import { loadCompany } from '../../../company';

export const metadata: Metadata = { title: 'Editar curso — 3R' };

export default async function EditCoursePage({ params }: { params: Promise<{ id: string; courseId: string }> }) {
  const { id, courseId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<Course>(`/companies/${id}/training/${courseId}`);
  if (!res.ok || !res.data.can.manage) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/capacitaciones/${courseId}`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← {res.data.title}
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-2 font-display text-[22px] font-semibold text-foreground">Editar curso</h2>
        {res.data.status !== 'draft' ? (
          <p className="mb-6 text-[13.5px] text-muted-foreground">
            Quien ya vio una lección no pierde su avance. Si agregas lecciones, quienes ya lo terminaron conservan su certificado.
          </p>
        ) : (
          <div className="mb-6" />
        )}
        <CourseEditor companyId={id} course={res.data} />
      </div>
    </div>
  );
}
