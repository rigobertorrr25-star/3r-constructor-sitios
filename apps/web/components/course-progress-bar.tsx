/** Barra de avance de un curso (lecciones vistas sobre el total). */
export function CourseProgressBar({ done, total, completed }: { done: number; total: number; completed?: boolean }) {
  const pct = completed ? 100 : total ? Math.round((done / total) * 100) : 0;
  return (
    <span
      className="block h-2 overflow-hidden rounded-full bg-white/[0.06]"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Avance"
    >
      <span className={`block h-full rounded-full ${completed ? 'bg-[#5ee0a0]' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
    </span>
  );
}
