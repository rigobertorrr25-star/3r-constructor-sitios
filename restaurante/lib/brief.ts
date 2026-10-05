// Módulo 12: resumen del día para el dueño, escrito por Claude a partir de los números reales del tablero.
// La IA solo interpreta: no cambia datos ni inventa cifras. Sin ANTHROPIC_API_KEY se arma el mismo resumen con una
// plantilla, para que la pantalla nunca quede vacía.
import { formatCop } from './format';
import Anthropic from '@anthropic-ai/sdk';
import { query } from './db';
import { getDashboard, type Dashboard } from './dashboard';
import { requirePermission, type Actor } from './store';

const MODEL = 'claude-opus-5-5';

const money = (n: number) => formatCop(n);

const SYSTEM = `Eres el asistente financiero de un restaurante o bar en Colombia. Recibes los números reales de un día
(ventas, costos, utilidad, caja, lo más vendido, tiempos de cocina y un "radar de fugas" con señales de posibles pérdidas).
Escribe para el dueño, en español de Colombia, sencillo y directo, como un mensaje de WhatsApp de un administrador de
confianza: un párrafo corto que diga qué pasó hoy, y luego como máximo tres frases de lo que debería revisar, empezando por
la señal más grave del radar. Usa solo las cifras que recibes, escritas en pesos con punto de miles ($8.460.000). No
inventes causas: si algo es una sospecha, dilo como sospecha. Si fue un día sin ventas, dilo en una frase. Sin títulos,
sin viñetas, sin emojis. Máximo 120 palabras.`;

/** Lo que se le manda a la IA: solo agregados del negocio (nada de clientes ni empleados por nombre). */
export function briefFacts(d: Dashboard, label: string) {
  const st = d.statement;
  return {
    dia: label,
    ventas: st.sales,
    mesas_cobradas: st.tables,
    personas: st.guests,
    ticket_promedio_mesa: st.averageTicket,
    costo_de_productos: st.costOfSales,
    utilidad_operativa: st.operatingProfit,
    gastos: st.expensesTotal,
    mermas: st.waste,
    faltantes_inventario: st.inventoryShortage,
    descuentos: st.discounts,
    propinas_del_equipo: st.tips,
    caja_esperada_ahora: d.expectedCash,
    mesas_abiertas_ahora: d.openTables,
    mas_vendido: d.topByStation.flatMap((t) => t.items.map((i) => `${i.name} (${i.quantity})`)).slice(0, 5),
    tiempo_preparacion_min: Object.fromEntries(d.prep.map((p) => [p.station === 'kitchen' ? 'cocina' : 'barra', p.avgMinutes])),
    indice_radar_de_fugas: d.score,
    senales: d.signals.filter((s) => s.level !== 'ok').map((s) => ({ senal: s.title, nivel: s.level === 'alert' ? 'alerta' : 'revisar', valor: s.value, detalle: s.detail })),
    insumos_por_comprar: d.lowStock.map((l) => l.name),
  };
}

/** El mismo resumen sin IA (si no hay llave o la IA falla). */
export function templateBrief(d: Dashboard, label: string) {
  const st = d.statement;
  if (st.sales === 0 && st.tables === 0) return `${label}: todavía no hay ventas cobradas.${d.openTables ? ` Hay ${d.openTables} mesas abiertas con ${money(d.openTablesValue)} por cobrar.` : ''}`;
  const parts = [
    `${label} se vendieron ${money(st.sales)} en ${st.tables} ${st.tables === 1 ? 'mesa' : 'mesas'} (ticket promedio ${money(st.averageTicket)}), con una utilidad operativa de ${money(st.operatingProfit)}.`,
  ];
  const top = d.topByStation.flatMap((t) => t.items)[0];
  if (top) parts.push(`Lo más vendido fue ${top.name} (${top.quantity}).`);
  const alerts = d.signals.filter((s) => s.level !== 'ok').sort((a, b) => b.points - a.points);
  if (alerts.length) parts.push(`Para revisar: ${alerts.slice(0, 3).map((s) => `${s.title.toLowerCase()} (${s.value})`).join('; ')}. Índice del radar: ${d.score}/100.`);
  else parts.push(`El radar de fugas no muestra alertas (${d.score}/100).`);
  if (d.lowStock.length) parts.push(`Por comprar: ${d.lowStock.map((l) => l.name).join(', ')}.`);
  return parts.join(' ');
}

/** Pide el texto a Claude. Devuelve null si no hay llave, si declina o si falla (y se usa la plantilla). */
async function writeWithClaude(facts: ReturnType<typeof briefFacts>): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // Resumen corto de datos ya calculados: esfuerzo bajo alcanza y sale más barato.
      output_config: { effort: 'low' },
      // Si el modelo declina por política, la API reintenta sola con otro modelo.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: `Números del día (JSON):\n${JSON.stringify(facts)}` }],
    });
    if (response.stop_reason === 'refusal') return null;
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || null;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) console.error('ANTHROPIC_API_KEY no es válida');
    else if (error instanceof Anthropic.RateLimitError) console.error('Límite de la API de Anthropic: se usa la plantilla');
    else console.error('Resumen con IA falló:', error instanceof Error ? error.message : error);
    return null;
  }
}

export type Brief = { text: string; source: 'ia' | 'plantilla'; createdAt: Date; cached: boolean };

/**
 * El resumen de un día. Se guarda una vez por día y alcance; `refresh` lo vuelve a escribir (por ejemplo, al final
 * de la noche con todas las ventas). El día de hoy guardado con más de 1 hora se rehace solo.
 */
export async function getBrief(actor: Actor, input: { day: string; locationId: string | null; timeZone: string; refresh?: boolean }): Promise<Brief> {
  requirePermission(actor, 'finance.view');
  const d = await getDashboard(actor, { from: input.day, to: input.day, locationId: input.locationId }, input.timeZone);
  const scope = d.statement.scope ?? 'all';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: input.timeZone }).format(new Date());
  if (!input.refresh) {
    const saved = (
      await query<{ text: string; source: string; createdAt: Date; stale: boolean }>(
        `SELECT text, source, created_at AS "createdAt", (day = $4::date AND created_at < now() - interval '1 hour') AS stale
           FROM daily_briefs WHERE business_id = $1 AND scope = $2 AND day = $3`,
        [actor.businessId, scope, input.day, today],
      )
    )[0];
    if (saved && !saved.stale) return { text: saved.text, source: saved.source === 'plantilla' ? 'plantilla' : 'ia', createdAt: saved.createdAt, cached: true };
  }
  const label = input.day === today ? 'Hoy' : `El ${new Date(`${input.day}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;
  const ai = await writeWithClaude(briefFacts(d, label));
  const text = ai ?? templateBrief(d, label);
  const source = ai ? 'ia' : 'plantilla';
  const row = (
    await query<{ createdAt: Date }>(
      `INSERT INTO daily_briefs (business_id, scope, day, text, source, created_by) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (business_id, scope, day) DO UPDATE SET text = EXCLUDED.text, source = EXCLUDED.source, created_by = EXCLUDED.created_by, created_at = now()
       RETURNING created_at AS "createdAt"`,
      [actor.businessId, scope, input.day, text, source, actor.id],
    )
  )[0];
  return { text, source, createdAt: row.createdAt, cached: false };
}

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
