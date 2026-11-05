// Avatar dibujado de cada empleado (estilo «Adventurer» de Lisa Wischofsky, CC BY 4.0, vía DiceBear). Sale de su
// id, de un número que cambia con "Otro avatar" y de si es hombre o mujer: no se guarda ninguna imagen.
// Este archivo lo usan también los componentes del navegador.
import type { Gender } from './gender';

/** Dirección del avatar; la sirve app/avatar/[seed]. */
export const avatarSrc = (employeeId: string, variant: number, gender: Gender) =>
  `/avatar/${employeeId}${variant ? `-${variant}` : ''}-${gender}`;

/** Lo que acepta la dirección: un id (uuid), opcional -número y, al final, -m o -f. */
export const AVATAR_SEED = /^([0-9a-f-]{36}(?:-\d{1,6})?)(?:-([mf]))?$/i;
