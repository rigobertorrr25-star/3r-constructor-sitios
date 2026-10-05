// Estaciones de producción. Archivo sin base de datos: lo usan también las pantallas del navegador.
export const STATIONS = ['kitchen', 'bar'] as const;
export type Station = (typeof STATIONS)[number];
export const STATION_LABEL: Record<Station, string> = { kitchen: 'Cocina', bar: 'Barra' };

export const isStation = (value: string): value is Station => (STATIONS as readonly string[]).includes(value);
