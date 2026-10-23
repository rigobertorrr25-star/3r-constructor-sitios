'use client';

import { useCallback, useState } from 'react';
import { applyLibraryPhotosAction, importMenuAction, readMenuFileAction, setCategoryStationsAction } from '@/app/actions';
import { AiFileReader } from './ai-read';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Select, TextArea, card } from './ui';
import { useT } from './i18n';

const EXAMPLE = `Cervezas
Corona ........ $ 12.000
Club Colombia   8.000

Cócteles
Mojito  27000`;

/** Carta → Importar carta: pegar la carta en texto (o leerla de un PDF o fotos) y cargarla de una vez. */
export function MenuImport({ barOnly, open }: { barOnly: boolean; open: boolean }) {
  const t = useT();
  const [menu, setMenu] = useState('');
  const clear = useCallback(() => setMenu(''), []);
  return (
    <details className={card} open={open}>
      <summary className="cursor-pointer font-display text-[18px] font-bold">{t('Importar carta')}</summary>
      <p className="mt-2 text-[14px] text-muted-foreground">
        {t(
          'Pega la carta: el nombre de cada categoría en su propia línea y debajo sus productos, cada uno con su precio al final. Lo que ya existe no se repite; si el precio cambió, se actualiza.',
        )}
      </p>
      <div className="mt-4">
        <AiFileReader
          action={readMenuFileAction}
          onText={setMenu}
          hint={t('¿La tienes en PDF o en fotos? Súbela y la IA la pasa a texto aquí abajo. Revísala antes de importar: puede equivocarse en algún nombre o precio.')}
        />
      </div>
      <ActionForm action={importMenuAction} className="mt-4 space-y-3" resetOnOk onOk={clear}>
        {() => (
          <>
            <TextArea label={t('Carta')} name="menu" rows={14} required placeholder={EXAMPLE} value={menu} onChange={(e) => setMenu(e.target.value)} />
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

/** Carta → «¿A dónde va cada categoría?»: escoger cocina o barra para todas las categorías de una vez (sus productos se van con ellas). */
export function CategoryStations({ categories }: { categories: { id: string; name: string; station: 'kitchen' | 'bar'; products: number }[] }) {
  const t = useT();
  return (
    <details className={card}>
      <summary className="cursor-pointer font-display text-[18px] font-bold">{t('¿A dónde va cada categoría?')}</summary>
      <p className="mt-2 text-[14px] text-muted-foreground">
        {t('Escoge si cada categoría sale en cocina o en barra. Sus productos se van con ella, en la pantalla y en la impresora de esa estación.')}
      </p>
      <ActionForm action={setCategoryStationsAction} className="mt-4 space-y-3">
        {() => (
          <>
            <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08]">
              {categories.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{c.name}</span>
                    <span className="text-[12.5px] text-muted-foreground">{c.products === 1 ? t('1 producto') : t('{n} productos', { n: c.products })}</span>
                  </span>
                  <span className="flex gap-2" role="radiogroup" aria-label={c.name}>
                    {(['kitchen', 'bar'] as const).map((station) => (
                      <label key={station} className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-1.5 text-[14px] has-[:checked]:border-primary has-[:checked]:bg-primary/15">
                        <input type="radio" name={`station:${c.id}`} value={station} defaultChecked={c.station === station} className="accent-[#8a9bff]" />
                        {station === 'kitchen' ? t('Cocina') : t('Barra')}
                      </label>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <SubmitButton pendingText={t('Guardando…')}>{t('Guardar')}</SubmitButton>
          </>
        )}
      </ActionForm>
    </details>
  );
}
