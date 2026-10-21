import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MuestraView } from '@/components/muestra-view';
import { getMuestra, MUESTRAS } from '@/lib/muestras';

export const dynamicParams = false;
export const generateStaticParams = () => MUESTRAS.map((m) => ({ slug: m.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const m = getMuestra((await params).slug);
  if (!m) return {};
  const title = `${m.name} · muestra de 3R`;
  const description = `Así se vería la página de ${m.name}. Hecha por 3R como muestra.`;
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, siteName: '3R', locale: 'es_CO', type: 'website' } };
}

/** Muestra de venta para un negocio sin página: se le manda al dueño por WhatsApp. */
export default async function MuestraPage({ params }: { params: Promise<{ slug: string }> }) {
  const m = getMuestra((await params).slug);
  if (!m) notFound();
  return <MuestraView m={m} />;
}
