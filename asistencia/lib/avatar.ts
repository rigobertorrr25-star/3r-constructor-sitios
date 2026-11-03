// Avatar dibujado de cada empleado (estilo Notionists, CC0). Sale solo de su id y de un número que cambia con
// "Otro avatar": no se guarda ninguna imagen. Este archivo lo usan también los componentes del navegador.

/** Dirección del avatar; la sirve app/avatar/[seed]. */
export const avatarSrc = (employeeId: string, variant = 0) => `/avatar/${employeeId}${variant ? `-${variant}` : ''}`;

/** Lo que acepta la dirección: un id (uuid) y, opcional, -número. */
export const AVATAR_SEED = /^[0-9a-f-]{36}(-\d{1,6})?$/i;
