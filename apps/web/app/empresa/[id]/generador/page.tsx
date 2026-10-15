import type { Metadata } from 'next';
import Link from 'next/link';
import { DocGeneratorForm } from '@/components/doc-generator-form';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { atLeast } from '@/lib/companies';
import type { GeneratorPeople, GeneratorTemplate } from '@/lib/doc-generator';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Generador de documentos — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const TEMPLATE_KEYS: GeneratorTemplate[] = ['employment_certificate', 'vacation_record', 'custom_letter'];

export default async function GeneratorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ member?: string; template?: string }>;
}) {
  const { id } = await params;
  const { member, template } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'doc_generator')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Generador de documentos"
        text="Certificados laborales, constancias de vacaciones y cartas en PDF, con los datos del empleado ya llenos y listos para firmar."
      />
    );
  }
  if (!atLeast(company.me.role, 'hr')) {
    return (
      <div className="max-w-xl rounded-[28px] border border-white/[0.08] bg-card p-6">
        <h2 className="font-display text-[20px] font-semibold text-foreground">Esto lo maneja Recursos Humanos</h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Si necesitas un certificado laboral, pídelo en{' '}
          {company.modules.some((m) => m.key === 'requests' && m.enabled) ? (
            <Link href={`/empresa/${id}/solicitudes`} className="underline underline-offset-2 hover:text-foreground">
              Permisos y vacaciones
            </Link>
          ) : (
            'Permisos y vacaciones'
          )}
          .
        </p>
      </div>
    );
  }
  const { data } = await authedApi<GeneratorPeople>(`/companies/${id}/doc-generator/people`);
  const documentsEnabled = company.modules.some((m) => m.key === 'documents' && m.enabled);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <section className={card} aria-labelledby="h-generar">
        <h2 id="h-generar" className="mb-5 font-display text-[20px] font-semibold text-foreground">
          Generar un documento
        </h2>
        <DocGeneratorForm
          companyId={id}
          data={data}
          documentsEnabled={documentsEnabled}
          initialMember={member}
          initialTemplate={TEMPLATE_KEYS.find((t) => t === template)}
        />
      </section>
      <aside className="space-y-4">
        {data.company.missing.length > 0 ? (
          <div className="rounded-[24px] border border-[#ffd27a]/25 bg-[#ffd27a]/[0.05] p-5 text-[14px] text-foreground">
            A los datos de la empresa les falta: {data.company.missing.join(' y ')}. Ponlos en{' '}
            <Link href={`/empresa/${id}/datos`} className="underline underline-offset-2">
              Datos de la empresa
            </Link>{' '}
            para que salgan en el membrete.
          </div>
        ) : null}
        <div className="rounded-[24px] border border-white/[0.08] bg-card p-5 text-[14px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Cómo funciona</p>
          <p className="mt-2">
            Los datos salen de la ficha de cada persona (Portal del empleado y Equipo) y de los datos de la empresa. El PDF queda listo para imprimir
            y firmar.
          </p>
          <p className="mt-2">Cada documento generado queda registrado: quién lo generó, para quién y cuándo.</p>
        </div>
      </aside>
    </div>
  );
}
