'use client';

import { useActionState, useState } from 'react';
import {
  createBusinessAction,
  createManagerAction,
  deleteManagerAction,
  deleteRecordAction,
  resetPinAction,
  rotateKioskAction,
  saveEmployeeAction,
  saveShiftsAction,
  updateRecordAction,
} from '@/app/actions';
import { t, type Lang } from '@/lib/i18n';
import { toLocalInput, type Shift } from '@/lib/report';
import type { AttendanceEmployee, AttendanceRecord, Manager } from '@/lib/store';
import { SubmitButton } from './submit-button';
import { Alert, CheckField, Field, quietButton } from './ui';

export function CreateBusinessForm({ lang }: { lang: Lang }) {
  const [state, action] = useActionState(createBusinessAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label={t(lang, 'businessName')} name="name" required minLength={2} maxLength={120} placeholder="Azul Caribe Lounge" defaultValue={state?.values?.name} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText={t(lang, 'creating')}>{t(lang, 'create')}</SubmitButton>
    </form>
  );
}

/** Agregar un empleado (sin `employee`) o editarlo. */
export function EmployeeForm({ businessId, employee, lang }: { businessId: string; employee?: AttendanceEmployee; lang: Lang }) {
  const [state, action] = useActionState(saveEmployeeAction, undefined);
  const v = state?.values;
  // Tras crear uno, el formulario se vacía para el siguiente.
  const formKey = employee ? employee.id : `new-${state?.ok ?? 0}`;
  return (
    <form key={formKey} action={action} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      {employee ? <input type="hidden" name="employeeId" value={employee.id} /> : null}
      <Field
        label={t(lang, 'name')}
        name="name"
        required
        minLength={2}
        maxLength={120}
        defaultValue={v?.name ?? employee?.name ?? ''}
        hint={employee ? undefined : t(lang, 'employeeNameHint')}
      />
      {employee ? (
        <CheckField
          label={t(lang, 'active')}
          name="isActive"
          defaultChecked={v ? v.isActive === 'on' : employee.isActive}
          hint={t(lang, 'activeHint')}
        />
      ) : null}
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok && employee ? <Alert tone="ok">{t(lang, 'changesSaved')}</Alert> : null}
      {state?.ok && !employee ? <Alert tone="ok">{t(lang, 'employeeAdded')}</Alert> : null}
      <SubmitButton pendingText={t(lang, 'saving')}>{employee ? t(lang, 'saveChanges') : t(lang, 'addEmployee')}</SubmitButton>
    </form>
  );
}

/** Para un PIN olvidado: el empleado crea uno nuevo la próxima vez que escanee. */
export function ResetPinButton({ businessId, employee, lang }: { businessId: string; employee: AttendanceEmployee; lang: Lang }) {
  return (
    <form
      action={resetPinAction}
      onSubmit={(event) => {
        if (!window.confirm(t(lang, 'resetPinConfirm', { name: employee.name }))) event.preventDefault();
      }}
    >
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="employeeId" value={employee.id} />
      <button type="submit" className={quietButton}>
        {t(lang, 'resetPin')}
      </button>
    </form>
  );
}

/** Turnos del negocio. El de cada jornada se deduce solo de la hora de llegada. */
export function ShiftsForm({ businessId, shifts, lang }: { businessId: string; shifts: Shift[]; lang: Lang }) {
  const [state, action] = useActionState(saveShiftsAction, undefined);
  const v = state?.values;
  const rows = Array.from({ length: Math.max(3, Math.min(6, shifts.length + 1)) }, (_, i) => i);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      <div className="space-y-3">
        {rows.map((i) => (
          <div key={i} className="grid grid-cols-2 gap-3">
            <Field label={t(lang, 'shiftStartLabel', { n: i + 1 })} name={`start${i}`} type="time" defaultValue={v?.[`start${i}`] ?? shifts[i]?.start ?? ''} />
            <Field label={t(lang, 'shiftEndLabel')} name={`end${i}`} type="time" defaultValue={v?.[`end${i}`] ?? shifts[i]?.end ?? ''} />
          </div>
        ))}
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">{t(lang, 'shiftsSaved')}</Alert> : null}
      <SubmitButton pendingText={t(lang, 'saving')}>{t(lang, 'saveShifts')}</SubmitButton>
    </form>
  );
}

export function KioskLink({ url, businessId, lang }: { url: string; businessId: string; lang: Lang }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <p className="break-all rounded-2xl bg-white/[0.04] px-4 py-3 text-[14px] text-foreground">{url}</p>
      <div className="flex flex-wrap gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className={quietButton}>
          {t(lang, 'openTablet')}
        </a>
        <button
          type="button"
          className={quietButton}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2_000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? t(lang, 'copied') : t(lang, 'copyLink')}
        </button>
        <form
          action={rotateKioskAction}
          onSubmit={(event) => {
            if (!window.confirm(t(lang, 'changeLinkConfirm'))) event.preventDefault();
          }}
        >
          <input type="hidden" name="businessId" value={businessId} />
          <button type="submit" className={`${quietButton} text-muted-foreground`}>
            {t(lang, 'changeLink')}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Corregir una jornada: una salida olvidada o una hora mal marcada. */
export function RecordEditor({ businessId, record, lang }: { businessId: string; record: AttendanceRecord; lang: Lang }) {
  const [state, action] = useActionState(updateRecordAction, undefined);
  const v = state?.values;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[13px] text-primary hover:underline">{record.clockOut ? t(lang, 'fix') : t(lang, 'addExit')}</summary>
      <form action={action} className="mt-3 space-y-3 rounded-2xl bg-white/[0.03] p-4">
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="recordId" value={record.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t(lang, 'clockIn')} name="clockIn" type="datetime-local" required defaultValue={v?.clockIn ?? toLocalInput(new Date(record.clockIn))} />
          <Field
            label={t(lang, 'clockOut')}
            name="clockOut"
            type="datetime-local"
            defaultValue={v?.clockOut ?? (record.clockOut ? toLocalInput(new Date(record.clockOut)) : '')}
            hint={t(lang, 'clockOutHint')}
          />
        </div>
        {state?.error ? <Alert>{state.error}</Alert> : null}
        {state?.ok ? <Alert tone="ok">{t(lang, 'fixed')}</Alert> : null}
        <SubmitButton pendingText={t(lang, 'saving')}>{t(lang, 'save')}</SubmitButton>
      </form>
      <form
        action={deleteRecordAction}
        className="mt-2"
        onSubmit={(event) => {
          if (!window.confirm(t(lang, 'deleteRecordConfirm', { name: record.employee.name }))) event.preventDefault();
        }}
      >
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="recordId" value={record.id} />
        <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
          {t(lang, 'deleteRecord')}
        </button>
      </form>
    </details>
  );
}

/** Dar acceso de solo lectura a un jefe: nombre y una clave que el administrador le entrega. */
export function ManagerForm({ businessId, lang, signInUrl }: { businessId: string; lang: Lang; signInUrl: string }) {
  const [state, action] = useActionState(createManagerAction, undefined);
  return (
    <form key={`manager-${state?.ok ?? 0}`} action={action} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      <Field label={t(lang, 'managerName')} name="name" required minLength={2} maxLength={120} defaultValue={state?.values?.name ?? ''} />
      <Field
        label={t(lang, 'managerPassword')}
        name="password"
        type="text"
        required
        minLength={8}
        maxLength={200}
        autoComplete="off"
        hint={t(lang, 'managerPasswordHint')}
      />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">{t(lang, 'managerAdded', { url: signInUrl })}</Alert> : null}
      <SubmitButton pendingText={t(lang, 'saving')}>{t(lang, 'addManager')}</SubmitButton>
    </form>
  );
}

export function DeleteManagerButton({ businessId, manager, lang }: { businessId: string; manager: Manager; lang: Lang }) {
  return (
    <form
      action={deleteManagerAction}
      onSubmit={(event) => {
        if (!window.confirm(t(lang, 'deleteManagerConfirm', { name: manager.name }))) event.preventDefault();
      }}
    >
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="managerId" value={manager.id} />
      <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
        {t(lang, 'deleteManager')}
      </button>
    </form>
  );
}
