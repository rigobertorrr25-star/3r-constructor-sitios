'use client';

import { importMenuAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Select, TextArea, card } from './ui';
import { useT } from './i18n';

const EXAMPLE = `Cervezas
Corona ........ $ 12.000
Club Colombia   8.000

Cócteles
Mojito  27000`;

/** Carta → Importar carta: pegar la carta en texto y cargarla de una vez (categorías y productos con precio). */
export function MenuImport({ barOnly, open }: { barOnly: boolean; open: boolean }) {
  const t = useT();
  return (
    <details className={card} open={open}>
      <summary className="cursor-pointer font-display text-[18px] font-bold">{t('Importar carta')}</summary>
      <p className="mt-2 text-[14px] text-muted-foreground">
        {t(
          'Pega la carta: el nombre de cada categoría en su propia línea y debajo sus productos, cada uno con su precio al final. Lo que ya existe no se repite; si el precio cambió, se actualiza.',
        )}
      </p>
      <ActionForm action={importMenuAction} className="mt-4 space-y-3" resetOnOk>
        {(state) => (
          <>
            <TextArea label={t('Carta')} name="menu" rows={14} required placeholder={EXAMPLE} defaultValue={state?.values?.menu} />
            {barOnly ? null : (
              <Select label={t('Va a')} name="station" defaultValue="bar">
                <option value="bar">{t('Barra')}</option>
                <option value="kitchen">{t('Cocina')}</option>
              </Select>
            )}
            <SubmitButton pendingText={t('Importando…')}>{t('Importar carta')}</SubmitButton>
          </>
        )}
      </ActionForm>
    </details>
  );
}
