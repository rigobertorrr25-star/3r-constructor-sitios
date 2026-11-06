// Anulaciones que no son pérdida (6 nov 2026, pedido de Rigoberto: «cuando el motivo diga que el mesero se equivocó, o
// cambió, o cosas así, que no descuente en el cierre ni en el inventario: en realidad no se preparó; con otro motivo,
// que la anulación quede como pérdida»). También las usa el radar de fugas (antes solo «equivoc», 31 oct 2026).
// Palabras: equivoc… (se equivocó, equivocado), cambi… (cambió, cambio de pedido), error, repetid…, duplicad…,
// «mal marcado», «mal digitado», «mal pedido», «no se alcanzó a hacer», «no se preparó», «no se hizo».
export const NO_LOSS_VOID = /(^|[^a-záéíóúñ])(equivoc|cambi|error|repetid|duplicad|mal (marcad|digitad|pedid)|no se (alcanz|prepar|hiz))/i;
export const NO_LOSS_VOID_SQL = String.raw`\m(equivoc|cambi|error|repetid|duplicad|mal (marcad|digitad|pedid)|no se (alcanz|prepar|hiz))`;
export const isNoLossVoid = (reason: string) => NO_LOSS_VOID.test(reason);
