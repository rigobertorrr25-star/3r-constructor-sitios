'use client';

import { useActionState } from 'react';
import { savePersonalAction, saveWorkAction } from '@/app/empresa/employees-actions';
import { CONTRACT_LABEL, DOCUMENT_LABEL, type EmployeeProfile } from '@/lib/employees';
import { formKey } from './form-key';
import { CheckField, Field, SelectField, TextAreaField } from './field';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

const pesos = (n: number | null) => (n == null ? '' : new Intl.NumberFormat('es-CO').format(n));

export function PersonalForm({ companyId, profile, self }: { companyId: string; profile: EmployeeProfile; self: boolean }) {
  const [state, action] = useActionState(savePersonalAction, undefined);
  const p = profile.personal;
  const v = state?.error ? state.values : undefined;
  const val = (k: keyof typeof p) => v?.[k] ?? (p[k] as string | null) ?? '';
  return (
    <form action={action} className="space-y-5" key={formKey(profile.updatedAt, state)}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="memberId" value={profile.id} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Tipo de documento"
          name="documentType"
          defaultValue={val('documentType')}
          options={[{ value: '', label: 'Sin elegir' }, ...Object.entries(DOCUMENT_LABEL).map(([value, label]) => ({ value, label }))]}
        />
        <Field label="Número de documento" name="documentNumber" maxLength={30} inputMode="numeric" defaultValue={val('documentNumber')} />
        <Field label="Celular" name="phone" maxLength={50} defaultValue={val('phone')} />
        <Field label="Fecha de nacimiento" name="birthDate" type="date" defaultValue={val('birthDate')} />
        <Field label="Dirección" name="address" maxLength={200} defaultValue={val('address')} />
        <Field label="Ciudad" name="city" maxLength={100} defaultValue={val('city')} />
        <Field label="EPS" name="eps" maxLength={100} defaultValue={val('eps')} />
        <Field label="Fondo de pensiones" name="pensionFund" maxLength={100} defaultValue={val('pensionFund')} />
      </div>
      <fieldset className="space-y-5 rounded-2xl border border-white/[0.08] p-4">
        <legend className="px-1 text-sm font-medium text-foreground">En caso de emergencia, llamar a</legend>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Nombre" name="emergencyName" maxLength={150} defaultValue={val('emergencyName')} />
          <Field label="Celular" name="emergencyPhone" maxLength={50} defaultValue={val('emergencyPhone')} />
          <Field label="Parentesco" name="emergencyRelation" maxLength={60} defaultValue={val('emergencyRelation')} placeholder="Mamá, pareja…" />
        </div>
      </fieldset>
      <CheckField
        name="showPhone"
        label={self ? 'Mostrar mi celular en el directorio del equipo' : 'Mostrar su celular en el directorio del equipo'}
        hint="Si no, solo lo ven Recursos Humanos y la administración."
        defaultChecked={v ? v.showPhone === 'on' : p.showPhone}
      />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Datos guardados.</Alert> : null}
      <SubmitButton pendingText="Guardando…">Guardar datos personales</SubmitButton>
    </form>
  );
}

export function WorkForm({ companyId, profile }: { companyId: string; profile: EmployeeProfile }) {
  const [state, action] = useActionState(saveWorkAction, undefined);
  const w = profile.work;
  const v = state?.error ? state.values : undefined;
  return (
    <form action={action} className="space-y-5" key={formKey(profile.updatedAt, state)}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="memberId" value={profile.id} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Tipo de contrato"
          name="contractType"
          defaultValue={v?.contractType ?? w.contractType ?? ''}
          options={[{ value: '', label: 'Sin elegir' }, ...Object.entries(CONTRACT_LABEL).map(([value, label]) => ({ value, label }))]}
        />
        <Field
          label="Fin del contrato"
          name="contractEnd"
          type="date"
          defaultValue={v?.contractEnd ?? w.contractEnd ?? ''}
          hint="Solo si es a término fijo u obra."
        />
        <Field
          label="Salario mensual (pesos)"
          name="salary"
          inputMode="numeric"
          defaultValue={v?.salary ?? pesos(w.salary)}
          placeholder="1.423.500"
        />
        <Field
          label="Horario"
          name="schedule"
          maxLength={150}
          defaultValue={v?.schedule ?? w.schedule ?? ''}
          placeholder="Lunes a sábado, 8 a. m. a 4 p. m."
        />
      </div>
      <TextAreaField
        label="Notas de Recursos Humanos"
        name="hrNotes"
        rows={3}
        maxLength={4000}
        defaultValue={v?.hrNotes ?? w.hrNotes ?? ''}
        hint="El empleado no ve estas notas."
      />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Contrato guardado.</Alert> : null}
      <SubmitButton pendingText="Guardando…">Guardar contrato</SubmitButton>
    </form>
  );
}
