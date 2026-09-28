// Textos de la app en español e inglés. El idioma lo elige cada persona (botón ES | EN, se guarda en una
// cookie); si nunca lo eligió, se usa el idioma de su navegador. Este archivo no toca el servidor: lo usan
// también los componentes del navegador.

export type Lang = 'es' | 'en';
export const LANG_COOKIE = 'asistencia_lang';
export const LANGS: Lang[] = ['es', 'en'];

export const isLang = (value: unknown): value is Lang => value === 'es' || value === 'en';

/** Idioma cuando la persona no ha elegido: inglés solo si el navegador lo pide primero. */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  const first = (header ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'es';
}

const es = {
  appName: 'Asistencia 3R',
  appDescription: 'Control de entrada y salida de empleados con código QR.',
  lionAlt: 'León de 3R',
  lionWavingAlt: 'León de 3R saludando',
  switchLanguage: 'Idioma',

  // Ingreso
  signInTitle: 'Entrar',
  signInSubtitle: 'Entrada y salida de empleados con QR.',
  password: 'Clave',
  signingIn: 'Entrando…',
  signIn: 'Entrar',
  signOut: 'Salir',

  // Negocios
  businesses: 'Negocios',
  businessesIntro:
    'Una tablet en la entrada muestra un código QR que cambia cada 30 segundos. Cada empleado lo escanea con su celular y pone su PIN para marcar entrada o salida.',
  employeesCount: '{n} empleados',
  employeesCountOne: '1 empleado',
  addBusiness: '+ Agregar un negocio',
  businessName: 'Nombre del negocio',
  creating: 'Creando…',
  create: 'Crear',

  // Reporte
  reportTitle: 'Reporte',
  backToBusinesses: '← Negocios',
  previousWeek: '← Semana anterior',
  thisWeek: 'Esta semana',
  nextWeek: 'Semana siguiente →',
  downloadExcel: 'Descargar para Excel',
  noRecords: 'Nadie marcó en estas fechas.',
  totals: 'Totales',
  colEmployee: 'Empleado',
  colDays: 'Días',
  colHours: 'Horas',
  colLate: 'Llegadas tarde',
  colEarly: 'Salidas temprano',
  colMissingExit: 'Sin salida',
  lateTotal: '{count} ({time} en total)',
  reportNote:
    'El turno de cada jornada se deduce de la hora de llegada (y de salida, si ya marcó). Llegar o salir con {grace} minutos de diferencia no cuenta. Las horas solo suman jornadas con salida.',
  noExit: 'sin salida',
  shiftLabel: 'Turno {shift}',
  arrivedLate: 'llegó {time} tarde',
  leftEarly: 'salió {time} antes',
  editedByHand: 'corregido a mano',

  // Empleados
  employees: 'Empleados',
  employeesIntroOne: '1 activo. Cada uno crea su propio PIN de 4 números la primera vez que escanea el QR. Si alguien lo olvida, reinícialo y creará uno nuevo.',
  employeesIntro:
    '{n} activos. Cada uno crea su propio PIN de 4 números la primera vez que escanea el QR. Si alguien lo olvida, reinícialo y creará uno nuevo.',
  addEmployee: 'Agregar empleado',
  name: 'Nombre',
  employeeNameHint: 'Así lo verá en la lista al escanear. Su PIN lo crea él mismo la primera vez.',
  active: 'Activo',
  activeHint: 'Si ya no trabaja allí, desmárcalo: su PIN deja de servir y su historial se conserva.',
  changesSaved: 'Cambios guardados.',
  employeeAdded: 'Empleado agregado.',
  saving: 'Guardando…',
  saveChanges: 'Guardar cambios',
  pinCreated: 'PIN creado',
  pinMissing: 'Falta crear su PIN',
  resetPin: 'Reiniciar PIN',
  resetPinConfirm: '¿Reiniciar el PIN de {name}? La próxima vez que escanee, creará uno nuevo.',

  // Turnos
  shifts: 'Turnos',
  shiftsIntro: 'No se asignan por empleado: cada jornada toma el turno cuya hora de entrada está más cerca de cuando la persona marcó.',
  shiftsEmpty: 'Mientras no haya turnos, el reporte no muestra llegadas tarde.',
  shiftStartLabel: 'Turno {n}: entra',
  shiftEndLabel: 'sale',
  shiftsSaved: 'Turnos guardados.',
  saveShifts: 'Guardar turnos',

  // Tablet (panel)
  tabletSection: 'Tablet de la entrada',
  tabletSectionIntro:
    'Abre este enlace en la tablet (o un celular) que queda en la entrada, conectada a la corriente y al wifi. Muestra el QR que cambia cada 30 segundos. No lo compartas con los empleados: con este enlace se podría marcar desde otro lugar. Si se filtra, usa “Cambiar enlace”.',
  openTablet: 'Abrir pantalla de la tablet',
  copied: 'Copiado',
  copyLink: 'Copiar enlace',
  changeLink: 'Cambiar enlace',
  changeLinkConfirm: '¿Cambiar el enlace? La tablet con el enlace actual deja de funcionar y hay que abrir el nuevo en ella.',

  // Corregir jornada
  fix: 'Corregir',
  addExit: 'Poner salida',
  clockIn: 'Entrada',
  clockOut: 'Salida',
  clockOutHint: 'Vacía = sin salida.',
  fixed: 'Corregido.',
  save: 'Guardar',
  deleteRecordConfirm: '¿Borrar esta jornada de {name}? No se puede deshacer.',
  deleteRecord: 'Borrar jornada (marcación por error)',

  // Tablet de la entrada
  tabletTitle: 'Asistencia — tablet de la entrada',
  tabletInvalid: 'Este enlace de tablet ya no funciona. Pide el enlace nuevo a quien administra la asistencia.',
  tabletScan: 'Escanea con la cámara de tu celular para marcar entrada o salida',
  tabletQrLabel: 'Código QR para marcar asistencia',
  tabletOffline: 'Sin conexión. Revisa el wifi de la tablet; se reintenta solo.',
  tabletNote: 'El código cambia cada 30 segundos. Una foto del código no sirve después.',

  // Celular del empleado
  punchTitle: 'Marcar asistencia',
  punchFallbackTitle: 'Marcar entrada o salida',
  scanPrompt: 'Escanea el código QR de la tablet de la entrada con la cámara de tu celular.',
  offline: 'No hay conexión con el servidor. Intenta de nuevo en un momento.',
  entryRecorded: 'Entrada registrada',
  exitRecorded: 'Salida registrada',
  helloShift: '¡Hola, {name}! Buen turno.',
  goodbye: '¡Hasta luego, {name}!',
  youWorked: 'Trabajaste {time}.',
  pinSavedNote: 'Tu PIN quedó guardado. No se lo digas a nadie.',
  closePage: 'Ya puedes cerrar esta página.',
  noEmployeesYet: 'Todavía no hay empleados registrados. Avísale al administrador.',
  tapYourName: 'Toca tu nombre',
  notMe: 'No soy yo',
  firstTimeNote: 'Es tu primera vez. Crea un PIN de 4 números que solo tú sepas; lo vas a usar cada vez que marques.',
  createPin: 'Crea tu PIN',
  repeatPin: 'Escríbelo otra vez',
  enterPin: 'Escribe tu PIN',
  punching: 'Marcando…',
  savePinAndPunch: 'Guardar PIN y marcar',
  punch: 'Marcar',
  forgotPin: '¿Olvidaste tu PIN? Pide al administrador que lo reinicie.',

  notFoundTitle: 'Esta página no existe',
  notFoundText: 'Revisa el enlace o vuelve a escanear el código QR de la entrada.',

  // Excel
  csvDate: 'Fecha',
  csvEmployee: 'Empleado',
  csvShift: 'Turno (por la hora de llegada)',
  csvIn: 'Entrada',
  csvOut: 'Salida',
  csvHours: 'Horas trabajadas',
  csvLate: 'Minutos tarde',
  csvEarly: 'Minutos de salida temprano',
  csvEdited: 'Corregido a mano',
  csvNoExit: 'Sin salida',
  csvYes: 'Sí',
  csvFile: 'asistencia',

  // Errores
  errGeneric: 'Algo salió mal. Intenta de nuevo en un momento.',
  errTooManyAttempts: 'Demasiados intentos. Espera un minuto e intenta de nuevo.',
  errAuthNotConfigured: 'Falta configurar ADMIN_PASSWORD y SESSION_SECRET en el servidor.',
  errWrongPassword: 'Clave incorrecta.',
  errPinMismatch: 'Los dos PIN no coinciden. Escríbelos otra vez.',
  errCheckClockIn: 'Revisa la hora de entrada.',
  errCheckClockOut: 'Revisa la hora de salida.',
  errName: 'Escribe el nombre (entre 2 y 120 letras).',
  errBusinessName: 'Escribe el nombre del negocio (entre 2 y 120 letras).',
  errEmployeeName: 'Escribe el nombre del empleado (entre 2 y 120 letras).',
  errShiftBoth: 'Cada turno necesita hora de inicio y de fin.',
  errShiftFormat: 'Las horas deben tener el formato HH:MM (por ejemplo 08:00).',
  errShiftSame: 'Un turno no puede empezar y terminar a la misma hora.',
  errShiftDuplicate: 'Dos turnos no pueden empezar a la misma hora.',
  errShiftMax: 'Máximo {max} turnos.',
  errBusinessNotFound: 'Negocio no encontrado.',
  errBusinessMissing: 'Este negocio no existe.',
  errEmployeeNotFound: 'Empleado no encontrado.',
  errRecordNotFound: 'Registro no encontrado.',
  errCreateBusiness: 'No se pudo crear el negocio con ese nombre.',
  errCodeExpired: 'El código ya venció. Escanea otra vez el QR de la entrada.',
  errChooseName: 'Toca tu nombre en la lista.',
  errPinFormat: 'El PIN tiene 4 números.',
  errPinWrong: 'PIN incorrecto. Revísalo e intenta de nuevo.',
  errLocked: 'Demasiados PIN equivocados. Intenta en {minutes} min o pide al administrador que reinicie tu PIN.',
  errDoubleIn: 'Ya marcaste tu entrada hace un momento.',
  errDoubleOut: 'Ya marcaste tu salida hace un momento.',
  errDates: 'Fechas inválidas.',
  errRange: 'Rango de fechas inválido.',
  errRangeMax: 'El rango no puede pasar de {max} días.',
  errTimes: 'Revisa las horas.',
  errExitBeforeEntry: 'La salida debe ser después de la entrada.',
  errShiftTooLong: 'Una jornada no puede pasar de 24 horas.',
};

export type MessageKey = keyof typeof es;

const en: Record<MessageKey, string> = {
  appName: '3R Attendance',
  appDescription: 'Employee clock-in and clock-out with a QR code.',
  lionAlt: '3R lion',
  lionWavingAlt: '3R lion waving',
  switchLanguage: 'Language',

  signInTitle: 'Sign in',
  signInSubtitle: 'Employee clock-in and clock-out with QR.',
  password: 'Password',
  signingIn: 'Signing in…',
  signIn: 'Sign in',
  signOut: 'Sign out',

  businesses: 'Businesses',
  businessesIntro:
    'A tablet at the entrance shows a QR code that changes every 30 seconds. Each employee scans it with their phone and enters their PIN to clock in or out.',
  employeesCount: '{n} employees',
  employeesCountOne: '1 employee',
  addBusiness: '+ Add a business',
  businessName: 'Business name',
  creating: 'Creating…',
  create: 'Create',

  reportTitle: 'Report',
  backToBusinesses: '← Businesses',
  previousWeek: '← Previous week',
  thisWeek: 'This week',
  nextWeek: 'Next week →',
  downloadExcel: 'Download for Excel',
  noRecords: 'No one clocked in on these dates.',
  totals: 'Totals',
  colEmployee: 'Employee',
  colDays: 'Days',
  colHours: 'Hours',
  colLate: 'Late arrivals',
  colEarly: 'Early departures',
  colMissingExit: 'No clock-out',
  lateTotal: '{count} ({time} total)',
  reportNote:
    'Each shift is inferred from the clock-in time (and the clock-out time, if any). Arriving or leaving within {grace} minutes does not count. Hours only include shifts with a clock-out.',
  noExit: 'no clock-out',
  shiftLabel: 'Shift {shift}',
  arrivedLate: '{time} late',
  leftEarly: 'left {time} early',
  editedByHand: 'edited manually',

  employees: 'Employees',
  employeesIntroOne: '1 active. Each person creates their own 4-digit PIN the first time they scan the QR. If someone forgets it, reset it and they will create a new one.',
  employeesIntro:
    '{n} active. Each person creates their own 4-digit PIN the first time they scan the QR. If someone forgets it, reset it and they will create a new one.',
  addEmployee: 'Add employee',
  name: 'Name',
  employeeNameHint: 'This is how they will see themselves in the list when scanning. They create their own PIN the first time.',
  active: 'Active',
  activeHint: 'If they no longer work there, uncheck it: their PIN stops working and their history is kept.',
  changesSaved: 'Changes saved.',
  employeeAdded: 'Employee added.',
  saving: 'Saving…',
  saveChanges: 'Save changes',
  pinCreated: 'PIN created',
  pinMissing: 'PIN not created yet',
  resetPin: 'Reset PIN',
  resetPinConfirm: 'Reset the PIN for {name}? The next time they scan, they will create a new one.',

  shifts: 'Shifts',
  shiftsIntro: 'They are not assigned per employee: each workday takes the shift whose start time is closest to when the person clocked in.',
  shiftsEmpty: 'Until shifts are set, the report does not show late arrivals.',
  shiftStartLabel: 'Shift {n}: starts',
  shiftEndLabel: 'ends',
  shiftsSaved: 'Shifts saved.',
  saveShifts: 'Save shifts',

  tabletSection: 'Entrance tablet',
  tabletSectionIntro:
    'Open this link on the tablet (or a phone) that stays at the entrance, plugged in and on Wi-Fi. It shows the QR code that changes every 30 seconds. Do not share it with employees: with this link someone could clock in from somewhere else. If it leaks, use “Change link”.',
  openTablet: 'Open tablet screen',
  copied: 'Copied',
  copyLink: 'Copy link',
  changeLink: 'Change link',
  changeLinkConfirm: 'Change the link? The tablet with the current link will stop working and you will need to open the new one on it.',

  fix: 'Edit',
  addExit: 'Add clock-out',
  clockIn: 'Clock-in',
  clockOut: 'Clock-out',
  clockOutHint: 'Empty = no clock-out.',
  fixed: 'Updated.',
  save: 'Save',
  deleteRecordConfirm: 'Delete this workday for {name}? This cannot be undone.',
  deleteRecord: 'Delete workday (clocked by mistake)',

  tabletTitle: 'Attendance — entrance tablet',
  tabletInvalid: 'This tablet link no longer works. Ask the attendance administrator for the new link.',
  tabletScan: 'Scan with your phone camera to clock in or out',
  tabletQrLabel: 'QR code to clock in or out',
  tabletOffline: 'No connection. Check the tablet Wi-Fi; it retries automatically.',
  tabletNote: 'The code changes every 30 seconds. A photo of the code will not work later.',

  punchTitle: 'Clock in or out',
  punchFallbackTitle: 'Clock in or out',
  scanPrompt: 'Scan the QR code on the entrance tablet with your phone camera.',
  offline: 'Cannot reach the server. Please try again in a moment.',
  entryRecorded: 'Clocked in',
  exitRecorded: 'Clocked out',
  helloShift: 'Hi, {name}! Have a good shift.',
  goodbye: 'See you, {name}!',
  youWorked: 'You worked {time}.',
  pinSavedNote: 'Your PIN has been saved. Do not share it with anyone.',
  closePage: 'You can close this page now.',
  noEmployeesYet: 'There are no employees yet. Let the administrator know.',
  tapYourName: 'Tap your name',
  notMe: 'Not me',
  firstTimeNote: 'This is your first time. Create a 4-digit PIN that only you know; you will use it every time you clock in or out.',
  createPin: 'Create your PIN',
  repeatPin: 'Enter it again',
  enterPin: 'Enter your PIN',
  punching: 'Saving…',
  savePinAndPunch: 'Save PIN and clock in',
  punch: 'Clock in / out',
  forgotPin: 'Forgot your PIN? Ask the administrator to reset it.',

  notFoundTitle: 'This page does not exist',
  notFoundText: 'Check the link or scan the QR code at the entrance again.',

  csvDate: 'Date',
  csvEmployee: 'Employee',
  csvShift: 'Shift (by clock-in time)',
  csvIn: 'Clock-in',
  csvOut: 'Clock-out',
  csvHours: 'Hours worked',
  csvLate: 'Minutes late',
  csvEarly: 'Minutes left early',
  csvEdited: 'Edited manually',
  csvNoExit: 'No clock-out',
  csvYes: 'Yes',
  csvFile: 'attendance',

  errGeneric: 'Something went wrong. Please try again in a moment.',
  errTooManyAttempts: 'Too many attempts. Wait a minute and try again.',
  errAuthNotConfigured: 'ADMIN_PASSWORD and SESSION_SECRET are not set on the server.',
  errWrongPassword: 'Wrong password.',
  errPinMismatch: 'The two PINs do not match. Enter them again.',
  errCheckClockIn: 'Check the clock-in time.',
  errCheckClockOut: 'Check the clock-out time.',
  errName: 'Enter the name (2 to 120 characters).',
  errBusinessName: 'Enter the business name (2 to 120 characters).',
  errEmployeeName: 'Enter the employee name (2 to 120 characters).',
  errShiftBoth: 'Each shift needs a start and an end time.',
  errShiftFormat: 'Times must use the HH:MM format (for example 08:00).',
  errShiftSame: 'A shift cannot start and end at the same time.',
  errShiftDuplicate: 'Two shifts cannot start at the same time.',
  errShiftMax: 'Maximum {max} shifts.',
  errBusinessNotFound: 'Business not found.',
  errBusinessMissing: 'This business does not exist.',
  errEmployeeNotFound: 'Employee not found.',
  errRecordNotFound: 'Record not found.',
  errCreateBusiness: 'Could not create a business with that name.',
  errCodeExpired: 'The code has expired. Scan the QR code at the entrance again.',
  errChooseName: 'Tap your name in the list.',
  errPinFormat: 'The PIN has 4 digits.',
  errPinWrong: 'Wrong PIN. Check it and try again.',
  errLocked: 'Too many wrong PINs. Try again in {minutes} min or ask the administrator to reset your PIN.',
  errDoubleIn: 'You already clocked in a moment ago.',
  errDoubleOut: 'You already clocked out a moment ago.',
  errDates: 'Invalid dates.',
  errRange: 'Invalid date range.',
  errRangeMax: 'The range cannot be longer than {max} days.',
  errTimes: 'Check the times.',
  errExitBeforeEntry: 'The clock-out must be after the clock-in.',
  errShiftTooLong: 'A workday cannot be longer than 24 hours.',
};

const messages: Record<Lang, Record<MessageKey, string>> = { es, en };

export type Vars = Record<string, string | number>;

/** Texto en el idioma pedido, con {variables} reemplazadas. */
export function t(lang: Lang, key: MessageKey, vars?: Vars): string {
  const text = messages[lang][key] ?? messages.es[key];
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;
}

/** Locale para fechas y horas. */
export const locale = (lang: Lang) => (lang === 'en' ? 'en-US' : 'es-CO');
