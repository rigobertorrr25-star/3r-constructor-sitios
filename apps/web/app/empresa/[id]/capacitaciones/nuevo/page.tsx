import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CourseEditor } from '@/components/course-editor';
import { atLeast } from '@/lib/companies';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Nuevo curso — 3R' };

export default async function NewCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.some((m) => m.key === 'training' && m.enabled) || !atLeast(company.me.role, 'hr')) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/capacitaciones`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Capacitaciones
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">Nuevo curso</h2>
        <CourseEditor companyId={id} />
      </div>
    </div>
  );
}
