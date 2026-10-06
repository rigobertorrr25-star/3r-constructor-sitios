import { headers } from 'next/headers';
import { requireStaff } from '@/lib/auth';
import { elapsedMinutes, formatDateTime, formatElapsed, formatTime } from '@/lib/format';
import { agentStatus, listJobs, listPrinters } from '@/lib/printing';
import { AutoRefresh } from '@/components/auto-refresh';
import { AgentCodeForm, NewPrinterForm, PrinterRow, ReprintButton } from '@/components/printer-forms';
import { Empty, PageTitle, card } from '@/components/ui';
import { makeT, tr, type Lang } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'En cola', className: 'text-[#ffd479]' },
  printing: { label: 'Imprimiendo', className: 'text-[#ffd479]' },
  done: { label: 'Impresa', className: 'text-[#9df0c6]' },
  failed: { label: 'No salió', className: 'text-[#ffb4b5]' },
};

// El título de cada papel se guarda en español (así sale impreso); en pantalla se muestra en el idioma de quien mira.
const REPRINT = 'Reimpresión · ';
function jobTitle(lang: Lang, title: string): string {
  if (title.startsWith(REPRINT)) return makeT(lang)('Reimpresión · {title}', { title: jobTitle(lang, title.slice(REPRINT.length)) });
  return tr(lang, title);
}

export default async function PrintersPage() {
  const staff = await requireStaff('printers.manage');
  const [printers, agent, jobs, h] = await Promise.all([listPrinters(staff), agentStatus(staff), listJobs(staff), headers()]);
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const online = !!agent.seenAt && Date.now() - agent.seenAt.getTime() < 20_000;
  const lang = await getLang();
  const t = makeT(lang);

  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={5000} />
      <PageTitle
        title={t('Impresoras')}
        text={`${t('Las comandas salen impresas en la impresora de cada estación y las precuentas y el cierre de caja en la de caja.')} ${staff.locationCount > 1 ? t('Esta configuración es de la sede {location}.', { location: staff.locationName }) : ''}`}
      />

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[18px] font-bold">{t('Programa de impresión')}</h2>
          <span
            className={`rounded-full px-3 py-1 text-[13px] ${online ? 'bg-success/15 text-[#9df0c6]' : 'bg-destructive/15 text-[#ffb4b5]'}`}
            role="status"
          >
            {online
              ? t('Conectado')
              : agent.seenAt
                ? t('Desconectado · último contacto hace {time}', { time: formatElapsed(elapsedMinutes(agent.seenAt)) })
                : t('Todavía no se ha conectado')}
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-[14.5px] text-muted-foreground">
          {t('Un computador del restaurante (con Windows, o un mini PC) queda prendido con este programa. Recibe lo que hay que imprimir y lo manda a cada impresora por la red del local.')}
        </p>
        <ol className="mt-4 max-w-3xl list-decimal space-y-2 pl-5 text-[14.5px] leading-relaxed">
          <li>
            {t('Conecta cada impresora al router del local (cable de red o wifi) y dale una')} <strong>{t('IP fija')}</strong>.{' '}
            {t('Casi todas imprimen su IP si las prendes con el botón de avanzar papel (FEED) presionado.')}
          </li>
          <li>{t('Agrega cada impresora abajo, con su IP, y escoge qué imprime.')}</li>
          <li>
            {t('En el computador instala')} <strong>Node.js</strong>{' '}
            {t('(nodejs.org, versión LTS). Crea una carpeta, por ejemplo «Impresion 3R», y descarga ahí estos dos archivos:')}{' '}
            <a href="/impresion/agente-3r.mjs" download className="text-primary underline">
              agente-3r.mjs
            </a>{' '}
            {t('y')}{' '}
            <a href="/impresion/iniciar-windows.bat" download className="text-primary underline">
              iniciar-windows.bat
            </a>
            .
          </li>
          <li>
            {t('Abre')} <strong>iniciar-windows.bat</strong>. {t('La primera vez te pide la dirección del sistema')} (<code className="text-[13.5px]">{origin}</code>){' '}
            {t('y el código de la sede (lo creas aquí abajo). Deja la ventana abierta.')}
          </li>
          <li>
            {t('Para que se prenda solo con el computador: tecla Windows + R, escribe')} <code className="text-[13.5px]">shell:startup</code>{' '}
            {t('y pon ahí un acceso directo a iniciar-windows.bat.')}
          </li>
          <li>{t('Toca «Imprimir prueba» en cada impresora. Debe salir un papel con su nombre y las tildes bien.')}</li>
        </ol>
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <p className="mb-3 text-sm font-medium">{t('Código de la sede para el programa')}</p>
          <AgentCodeForm hasCode={agent.hasCode} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[18px] font-bold">{t('Impresoras de esta sede')}</h2>
        {printers.length ? (
          <ul className="space-y-3">
            {printers.map((p) => (
              <PrinterRow key={p.id} printer={p} />
            ))}
          </ul>
        ) : (
          <Empty>{t('Todavía no hay impresoras. Mientras tanto, las comandas se ven en las pantallas de Cocina y Barra.')}</Empty>
        )}
      </section>

      <section className={card}>
        <h2 className="font-display text-[18px] font-bold">{t('Agregar impresora')}</h2>
        <div className="mt-4">
          <NewPrinterForm />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[18px] font-bold">{t('Últimas impresiones')}</h2>
        {jobs.length ? (
          <ul className="space-y-2">
            {jobs.map((j) => (
              <li key={j.id} className={`${card} !p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{jobTitle(lang, j.title)}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {j.printer} · {formatTime(j.createdAt, staff.timezone, lang)} ·{' '}
                      <span className={STATUS[j.status]?.className}>{STATUS[j.status] ? t(STATUS[j.status].label) : j.status}</span>
                      {j.status === 'done' && j.printedAt ? ` ${t('a las {time}', { time: formatTime(j.printedAt, staff.timezone, lang) })}` : ''}
                      {j.error && j.status !== 'done' ? ` · ${tr(lang, j.error)}` : ''}
                    </p>
                  </div>
                  <ReprintButton jobId={j.id} />
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground">Ver el papel</summary>
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-white p-3 font-mono text-[12px] leading-snug text-black">{j.preview}</pre>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t('Nada impreso todavía.')}</Empty>
        )}
        <p className="text-[13px] text-muted-foreground">
          {t('Lo que no se alcanza a imprimir en 6 horas (por ejemplo, si el computador estaba apagado) se descarta para no sacar comandas viejas. Desde aquí se puede reimprimir. Última actualización: {time}.', { time: formatDateTime(new Date(), staff.timezone, lang) })}
        </p>
      </section>
    </div>
  );
}
