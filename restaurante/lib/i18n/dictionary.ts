// Diccionario de inglés, repartido por partes del sistema.
import { en as comun } from './en/comun';
import { en as servidor } from './en/servidor';
import { en as ingreso } from './en/ingreso';
import { en as salon } from './en/salon';
import { en as dinero } from './en/dinero';
import { en as gestion } from './en/gestion';
import { en as agenda } from './en/agenda';
import { en as carta } from './en/carta';

export const EN: Record<string, string> = { ...comun, ...servidor, ...ingreso, ...salon, ...dinero, ...gestion, ...agenda, ...carta };
