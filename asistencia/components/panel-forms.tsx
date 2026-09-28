'use client';

import { useActionState, useState } from 'react';
import {
  createBusinessAction,
  deleteRecordAction,
  resetPinAction,
  rotateKioskAction,
  saveEmployeeAction,
  saveShiftsAction,
  updateRecordAction,
} from '@/app/actions';
import { toLocalInput, type Shift } from '@/lib/report';
import type { AttendanceEmployee, AttendanceRecord } from '@/lib/store';
import { SubmitButton } from './submit-button';
import { Alert, CheckField, Field, quietButton } from './ui';

export function CreateBusinessForm() {
  const [state, action] = useActionState(createBusinessAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Nombre del negocio" name="name" required minLength={2} maxLength={120} placeholder="Azul Caribe Lounge" defaultValue={state?.values?.name} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText="Creando…">Crear</SubmitButton>
    </form>
  );
}

/** Agregar un empleado (sin `employee`) o editarlo. */
export function EmployeeForm({ businessId, employee }: { businessId: string; employee?: AttendanceEmployee }) {
  const [state, action] = useActionState(saveEmployeeAction, undefined);
  const v = state?.values;
  // Tras crear uno, el formulario se vacía para el siguiente.
  const formKey = employee ? employee.id : `new-${state?.ok ?? 0}`;
  return (
    <form key={formKey} action={action} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      {employee ? <input type="hidden" name="employeeId" value={employee.id} /> : null}
      <Field
        label="Nombre"
        name="name"
        required
        minLength={2}
        maxLength={120}
        defaultValue={v?.name ?? employee?.name ?? ''}
        hint={employee ? undefined : 'Así lo verá en la lista al escanear. Su PIN lo crea él mismo la primera vez.'}
      />
      {employee ? (
        <CheckField
          label="Activo"
          name="isActive"
          defaultChecked={v ? v.isActive === 'on' : employee.isActive}
          hint="Si ya no trabaja allí, desmárcalo: su PIN deja de servir y su historial se conserva."
        />
      ) : null}
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok && employee ? <Alert tone="ok">Cambios guardados.</Alert> : null}
      {state?.ok && !employee ? <Alert tone="ok">Empleado agregado.</Alert> : null}
      <SubmitButton pendingText="Guardando…">{employee ? 'Guardar cambios' : 'Agregar empleado'}</SubmitButton>
    </form>
  );
}

/** Para un PIN olvidado: el empleado crea uno nuevo la próxima vez que escanee. */
export function ResetPinButton({ businessId, employee }: { businessId: string; employee: AttendanceEmployee }) {
  return (
    <form
      action={resetPinAction}
      onSubmit={(event) => {
        if (!window.confirm(`¿Reiniciar el PIN de ${employee.name}? La próxima vez que escanee, creará uno nuevo.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="employeeId" value={employee.id} />
      <button type="submit" className={quietButton}>
        Reiniciar PIN
      </button>
    </form>
  );
}

/** Turnos del negocio. El de cada jornada se deduce solo de la hora de llegada. */
export function ShiftsForm({ businessId, shifts }: { businessId: string; shifts: Shift[] }) {
  const [state, action] = useActionState(saveShiftsAction, undefined);
  const v = state?.values;
  const rows = Array.from({ length: Math.max(3, Math.min(6, shifts.length + 1)) }, (_, i) => i);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      <div className="space-y-3">
        {rows.map((i) => (
          <div key={i} className="grid grid-cols-2 gap-3">
            <Field label={`Turno ${i + 1}: entra`} name={`start${i}`} type="time" defaultValue={v?.[`start${i}`] ?? shifts[i]?.start ?? ''} />
            <Field label="sale" name={`end${i}`} type="time" defaultValue={v?.[`end${i}`] ?? shifts[i]?.end ?? ''} />
          </div>
        ))}
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Turnos guardados.</Alert> : null}
      <SubmitButton pendingText="Guardando…">Guardar turnos</SubmitButton>
    </form>
  );
}

export function KioskLink({ url, businessId }: { url: string; businessId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <p className="break-all rounded-2xl bg-white/[0.04] px-4 py-3 text-[14px] text-foreground">{url}</p>
      <div className="flex flex-wrap gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className={quietButton}>
          Abrir pantalla de la tablet
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
          {copied ? 'Copiado' : 'Copiar enlace'}
        </button>
        <form
          action={rotateKioskAction}
          onSubmit={(event) => {
            if (!window.confirm('¿Cambiar el enlace? La tablet con el enlace actual deja de funcionar y hay que abrir el nuevo en ella.')) event.preventDefault();
          }}
        >
          <input type="hidden" name="businessId" value={businessId} />
          <button type="submit" className={`${quietButton} text-muted-foreground`}>
            Cambiar enlace
          </button>
        </form>
      </div>
    </div>
  );
}

/** Corregir una jornada: una salida olvidada o una hora mal marcada. */
export function RecordEditor({ businessId, record }: { businessId: string; record: AttendanceRecord }) {
  const [state, action] = useActionState(updateRecordAction, undefined);
  const v = state?.values;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[13px] text-primary hover:underline">{record.clockOut ? 'Corregir' : 'Poner salida'}</summary>
      <form action={action} className="mt-3 space-y-3 rounded-2xl bg-white/[0.03] p-4">
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="recordId" value={record.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Entrada" name="clockIn" type="datetime-local" required defaultValue={v?.clockIn ?? toLocalInput(new Date(record.clockIn))} />
          <Field
            label="Salida"
            name="clockOut"
            type="datetime-local"
            defaultValue={v?.clockOut ?? (record.clockOut ? toLocalInput(new Date(record.clockOut)) : '')}
            hint="Vacía = sin salida."
          />
        </div>
        {state?.error ? <Alert>{state.error}</Alert> : null}
        {state?.ok ? <Alert tone="ok">Corregido.</Alert> : null}
        <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
      </form>
      <form
        action={deleteRecordAction}
        className="mt-2"
        onSubmit={(event) => {
          if (!window.confirm(`¿Borrar esta jornada de ${record.employee.name}? No se puede deshacer.`)) event.preventDefault();
        }}
      >
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="recordId" value={record.id} />
        <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
          Borrar jornada (marcación por error)
        </button>
      </form>
    </details>
  );
}
