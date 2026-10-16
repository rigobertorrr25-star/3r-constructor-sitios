'use client';

import { applyLibraryPhotosAction, importMenuAction } from '@/app/actions';
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

/** Carta → «Fotos de la biblioteca»: cada producto sin foto recibe la de la biblioteca de 3R (por su nombre). */
export function LibraryPhotos({ withoutPhoto }: { withoutPhoto: number }) {
  const t = useT();
  return (
    <section className={card}>
      <h2 className="font-display text-[18px] font-bold">{t('Fotos de la biblioteca de 3R')}</h2>
      <p className="mt-2 text-[14px] text-muted-foreground">
        {t('3R tiene fotos de las bebidas más comunes (cervezas, whisky, ron, aguardiente, tequila, cócteles…). Se ponen solas en los productos que no tienen foto; las que ya subiste no se tocan.')}{' '}
        {withoutPhoto ? t('Hay {n} productos sin foto.', { n: withoutPhoto }) : t('Todos los productos tienen foto.')}
      </p>
      {withoutPhoto ? (
        <ActionForm action={applyLibraryPhotosAction} className="mt-4 space-y-3">
          {() => <SubmitButton pendingText={t('Poniendo fotos…')}>{t('Poner fotos de la biblioteca')}</SubmitButton>}
        </ActionForm>
      ) : null}
    </section>
  );
}
