'use client';

import { addNetworkAction, removeNetworkAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { useT } from './i18n';

/** Lista de conexiones del wifi del local, «Agregar la conexión de aquí» y «Quitar» (6 nov 2026). */
export function NetworkForms({ networks, current }: { networks: string[]; current: string }) {
  const t = useT();
  const here = networks.includes(current);
  return (
    <div className="space-y-3">
      {networks.length ? (
        <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08]">
          {networks.map((n) => (
            <li key={n} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14.5px]">
              <span>
                {n}
                {n === current ? <span className="ml-2 text-[12.5px] text-success">{t('(esta es la conexión de ahora)')}</span> : null}
              </span>
              <ActionForm action={removeNetworkAction}>
                {() => (
                  <>
                    <input type="hidden" name="key" value={n} />
                    <SubmitButton tone="danger" pendingText={t('Quitando…')}>
                      {t('Quitar')}
                    </SubmitButton>
                  </>
                )}
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : null}
      {here ? null : (
        <ActionForm action={addNetworkAction}>
          {() => (
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton pendingText={t('Guardando…')}>{t('Agregar la conexión de aquí')}</SubmitButton>
              <span className="text-[13px] text-muted-foreground">{t('Conexión de ahora: {ip}', { ip: current })}</span>
            </div>
          )}
        </ActionForm>
      )}
    </div>
  );
}
