'use client';

import { useCallback, useState } from 'react';
import { importRecipesAction, readRecipesFileAction } from '@/app/actions';
import { AiFileReader } from './ai-read';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { TextArea } from './ui';
import { useT } from './i18n';

const EXAMPLE = `Mojito
Ron blanco 60 ml
Hierbabuena 8 g
Limón 1 und
Soda 120 ml

Michelada
Club Colombia 1 und
Limón 1 und`;

/** Inventario → Importar recetas: pegar las recetas (o leerlas de un PDF o fotos) y cargarlas a los productos de la carta. */
export function RecipeImport() {
  const t = useT();
  const [recipes, setRecipes] = useState('');
  const clear = useCallback(() => setRecipes(''), []);
  return (
    <details className="group rounded-[22px] border border-white/[0.08] bg-card p-5">
      <summary className="cursor-pointer list-none font-display text-[18px] font-bold">
        {t('Importar recetas')}
        <span className="mt-1 block font-sans text-[13.5px] font-normal text-muted-foreground">
          {t('El nombre del producto tal como está en la carta en su propia línea y debajo cada insumo con lo que lleva una porción (60 ml, 8 g, 1 und). Los insumos que no existen se crean; la receta de cada producto se reemplaza.')}
        </span>
      </summary>
      <div className="mt-4">
        <AiFileReader
          action={readRecipesFileAction}
          onText={setRecipes}
          hint={t('¿Tienes las recetas o fichas técnicas en PDF o en fotos? Súbelas y la IA las pasa a texto aquí abajo. Revísalas antes de importar: puede equivocarse en algún nombre o cantidad.')}
        />
      </div>
      <ActionForm action={importRecipesAction} className="mt-4 space-y-3" resetOnOk onOk={clear}>
        {() => (
          <>
            <TextArea label={t('Recetas')} name="recipes" rows={14} required placeholder={EXAMPLE} value={recipes} onChange={(e) => setRecipes(e.target.value)} />
            <SubmitButton pendingText={t('Importando…')}>{t('Importar recetas')}</SubmitButton>
          </>
        )}
      </ActionForm>
    </details>
  );
}
