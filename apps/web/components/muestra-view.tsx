'use client';

import { useMemo, useState } from 'react';
import type { Muestra, MuestraFont } from '@/lib/muestras';

const FONT: Record<MuestraFont, { family: string; weight: number; tracking: string; upper: boolean }> = {
  bebas: { family: "'Bebas Neue', Impact, sans-serif", weight: 400, tracking: '0.01em', upper: true },
  playfair: { family: "'Playfair Display', Georgia, serif", weight: 700, tracking: '-0.01em', upper: false },
  oswald: { family: "'Oswald', 'Arial Narrow', sans-serif", weight: 600, tracking: '0.02em', upper: true },
  sora: { family: "'Sora Variable', sans-serif", weight: 800, tracking: '-0.02em', upper: false },
};

const THREE_R = '573107907194';
const wa = (number: string, text: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
const thousands = (n: number) => n.toLocaleString('es-CO');

const SLOTS = ['9:00 a. m.', '10:00 a. m.', '11:00 a. m.', '12:00 m.', '2:00 p. m.', '3:00 p. m.', '4:00 p. m.', '5:00 p. m.', '6:00 p. m.', '7:00 p. m.'];

/** Hoy, mañana y los cuatro días siguientes, con la fecha de Colombia. */
function nextDays() {
  const fmt = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
  return Array.from({ length: 6 }, (_, i) => {
    const label = fmt.format(new Date(Date.now() + i * 86_400_000)).replace('.', '');
    return i === 0 ? `Hoy, ${label}` : i === 1 ? `Mañana, ${label}` : label.charAt(0).toUpperCase() + label.slice(1);
  });
}

export function MuestraView({ m }: { m: Muestra }) {
  const t = m.theme;
  const f = FONT[t.font];
  const display = { fontFamily: f.family, fontWeight: f.weight, letterSpacing: f.tracking, textTransform: f.upper ? 'uppercase' : 'none' } as const;
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const add = (name: string, d = 1) =>
    setCart((c) => {
      const n = Math.max(0, (c[name] ?? 0) + d);
      const next = { ...c, [name]: n };
      if (!n) delete next[name];
      return next;
    });

  const pitch = wa(THREE_R, `Hola, vi la muestra de la página de ${m.name} que hicieron en 3R y me interesa.`);

  return (
    <div
      style={{ background: t.bg, color: t.text, fontFamily: "'Manrope Variable', system-ui, sans-serif" }}
      className="min-h-screen overflow-x-hidden"
    >
      <div className="px-4 py-2.5 text-center text-[12.5px] leading-snug" style={{ background: '#000103', color: '#d7dce3' }}>
        Muestra hecha por <a href={pitch} className="font-bold text-white underline underline-offset-2">3R</a> para {m.name}. No es su página oficial.
      </div>

      <header className="relative overflow-hidden">
        <div className="mx-auto max-w-[1000px] px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-20">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: t.accent }}>{m.label}</p>
          <h1 className="mt-3 text-[54px] leading-[0.95] sm:text-[88px]" style={display}>{m.name}</h1>
          <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed sm:text-[19px]" style={{ color: t.muted }}>{m.tagline}</p>
          <p className="mt-5 text-[14.5px] font-semibold">
            <span style={{ color: t.accent }}>★ {m.rating.toLocaleString('es-CO')}</span>
            <span style={{ color: t.muted }}> · {thousands(m.reviews)} reseñas en Google</span>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={m.kind === 'pedidos' ? '#carta' : '#reservar'}
              className="rounded-[10px] px-6 py-3.5 text-[15.5px] font-bold"
              style={{ background: t.accent, color: t.onAccent }}
            >
              {m.kind === 'pedidos' ? 'Ver la carta y pedir' : m.kind === 'turnos' ? 'Pedir turno' : 'Reservar mesa'}
            </a>
            <a href={m.mapsUrl} target="_blank" rel="noreferrer" className="rounded-[10px] border px-6 py-3.5 text-[15.5px] font-bold" style={{ borderColor: t.muted }}>
              Cómo llegar
            </a>
          </div>
        </div>
      </header>

      <section id={m.kind === 'turnos' ? 'reservar' : 'carta'} className="mx-auto max-w-[1000px] px-5 py-10 sm:px-8">
        <h2 className="text-[38px] leading-none sm:text-[48px]" style={display}>{m.kind === 'turnos' ? 'Servicios' : 'La carta'}</h2>
        <p className="mt-3 max-w-[560px] text-[14px] leading-relaxed" style={{ color: t.muted }}>
          {m.kind === 'turnos'
            ? 'Servicios de ejemplo: aquí van los tuyos, con sus precios y fotos de tus cortes.'
            : 'Productos de ejemplo: aquí van los tuyos, con sus precios y fotos.'}
        </p>
        {m.kind === 'turnos' ? (
          <Turnos m={m} display={display} />
        ) : (
          <div className="mt-8 grid gap-10">
            {m.sections.map((s) => (
              <div key={s.title}>
                <h3 className="text-[24px] leading-none" style={display}>{s.title}</h3>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {s.items.map((it) => (
                    <li key={it.name} className="flex items-center justify-between gap-4 rounded-[12px] p-4" style={{ background: t.surface }}>
                      <div>
                        <p className="text-[16px] font-bold">{it.name}</p>
                        <p className="mt-0.5 text-[13.5px]" style={{ color: t.muted }}>{it.desc}</p>
                      </div>
                      {m.kind === 'pedidos' ? (
                        cart[it.name] ? (
                          <div className="flex shrink-0 items-center gap-2">
                            <button type="button" onClick={() => add(it.name, -1)} aria-label={`Quitar ${it.name}`} className="h-9 w-9 rounded-[8px] border text-[18px] font-bold" style={{ borderColor: t.muted }}>−</button>
                            <span className="w-5 text-center font-bold">{cart[it.name]}</span>
                            <button type="button" onClick={() => add(it.name)} aria-label={`Agregar ${it.name}`} className="h-9 w-9 rounded-[8px] text-[18px] font-bold" style={{ background: t.accent, color: t.onAccent }}>+</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => add(it.name)} className="shrink-0 rounded-[8px] px-4 py-2 text-[14px] font-bold" style={{ background: t.accent, color: t.onAccent }}>
                            Agregar
                          </button>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {m.kind === 'mesa' ? (
        <section id="reservar" className="mx-auto max-w-[1000px] px-5 py-10 sm:px-8">
          <h2 className="text-[38px] leading-none sm:text-[48px]" style={display}>Reservar mesa</h2>
          <Reserva m={m} />
        </section>
      ) : null}

      <section className="mx-auto max-w-[1000px] px-5 py-10 sm:px-8">
        <h2 className="text-[38px] leading-none sm:text-[48px]" style={display}>Visítanos</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 sm:items-center">
          {m.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.photo} alt={`Fachada de ${m.name}`} className="aspect-[4/3] w-full rounded-[14px] object-cover" />
          ) : null}
          <div className="text-[15.5px] leading-relaxed">
            <p className="font-bold">{m.address}</p>
            {m.hours.length ? (
              <ul className="mt-3" style={{ color: t.muted }}>
                {m.hours.map((h) => <li key={h}>{h}</li>)}
              </ul>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={m.mapsUrl} target="_blank" rel="noreferrer" className="rounded-[10px] border px-5 py-3 text-[14.5px] font-bold" style={{ borderColor: t.muted }}>
                Abrir en Google Maps
              </a>
              <a href={wa(m.whatsapp, `Hola ${m.name}, tengo una pregunta`)} className="rounded-[10px] px-5 py-3 text-[14.5px] font-bold" style={{ background: t.accent, color: t.onAccent }}>
                Escribir por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-28 pt-14 sm:px-8" style={{ background: '#000103', color: '#f2f6f8' }}>
        <div className="mx-auto max-w-[1000px]">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#8a9bff]">Para el dueño de {m.name}</p>
          <h2 style={{ fontFamily: "'Sora Variable', sans-serif" }} className="mt-3 max-w-[640px] text-[30px] font-extrabold leading-tight tracking-tight sm:text-[40px]">
            Esta página puede ser la tuya, con tus fotos, tus productos y tus precios.
          </h2>
          <ul className="mt-6 grid max-w-[640px] gap-2 text-[15.5px] leading-relaxed text-[#c9cfd8]">
            {m.kind === 'pedidos' ? <li>Tus clientes arman el pedido y te llega al WhatsApp ya escrito, sin pagar comisión a una app.</li> : null}
            {m.kind === 'turnos' ? <li>Tus clientes piden el turno solos y te llega al WhatsApp con el servicio, el día y la hora.</li> : null}
            {m.kind === 'mesa' ? <li>Tus clientes ven la carta y reservan la mesa; la reserva te llega al WhatsApp.</li> : null}
            <li>Con código QR para tus mesas, tu mostrador o tus redes.</li>
            <li>Hecha por nosotros, de principio a fin. Tú solo nos mandas tus fotos y precios.</li>
          </ul>
          <p className="mt-6 text-[17px] font-bold text-[#f7cb58]">
            {m.kind === 'pedidos' ? 'Menú con pedidos por WhatsApp: $350.000 · Página completa: desde $550.000' : 'Página completa: desde $550.000'}
            <span className="block text-[14px] font-semibold text-[#a5abb5]">Pago único.</span>
          </p>
          <a href={pitch} className="mt-7 inline-block rounded-[10px] bg-[#25d366] px-6 py-3.5 text-[15.5px] font-bold text-[#06210f]">
            La quiero: escribirle a 3R
          </a>
        </div>
      </section>

      {m.kind === 'pedidos' && count ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-[480px] rounded-[12px] px-5 py-4 text-[16px] font-bold shadow-2xl"
          style={{ background: t.accent, color: t.onAccent }}
        >
          Ver mi pedido ({count})
        </button>
      ) : null}
      {open ? <Pedido m={m} cart={cart} add={add} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

const field = 'mt-1.5 w-full rounded-[10px] border px-3.5 py-3 text-[16px] outline-none';

function Pedido({ m, cart, add, onClose }: { m: Muestra; cart: Record<string, number>; add: (n: string, d?: number) => void; onClose: () => void }) {
  const t = m.theme;
  const [name, setName] = useState('');
  const [delivery, setDelivery] = useState(true);
  const [address, setAddress] = useState('');
  const lines = Object.entries(cart);
  const text = [
    `Hola ${m.name}, quiero hacer este pedido:`,
    ...lines.map(([n, q]) => `• ${q} × ${n}`),
    '',
    name ? `A nombre de: ${name}` : '',
    delivery ? `Domicilio a: ${address || '(escribo la dirección)'}` : 'Paso a recogerlo',
  ].filter((l, i, a) => l || a[i - 1] !== '').join('\n');
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-t-[18px] p-5 sm:rounded-[18px]" style={{ background: t.bg, color: t.text }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-[20px] font-extrabold">Tu pedido</p>
          <button type="button" onClick={onClose} className="px-2 text-[15px] font-bold" style={{ color: t.muted }}>Cerrar</button>
        </div>
        <ul className="mt-4 grid gap-2">
          {lines.map(([n, q]) => (
            <li key={n} className="flex items-center justify-between gap-3 rounded-[10px] p-3" style={{ background: t.surface }}>
              <span className="font-semibold">{n}</span>
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => add(n, -1)} aria-label={`Quitar ${n}`} className="h-8 w-8 rounded-[8px] border font-bold" style={{ borderColor: t.muted }}>−</button>
                <span className="w-5 text-center font-bold">{q}</span>
                <button type="button" onClick={() => add(n)} aria-label={`Agregar ${n}`} className="h-8 w-8 rounded-[8px] font-bold" style={{ background: t.accent, color: t.onAccent }}>+</button>
              </span>
            </li>
          ))}
        </ul>
        <label className="mt-5 block text-[14px] font-semibold">Tu nombre
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} style={{ borderColor: t.muted, background: t.surface, color: t.text }} />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[14.5px] font-bold">
          {[true, false].map((d) => (
            <button key={String(d)} type="button" onClick={() => setDelivery(d)} className="rounded-[10px] border px-3 py-3" style={delivery === d ? { background: t.accent, color: t.onAccent, borderColor: t.accent } : { borderColor: t.muted }}>
              {d ? 'Domicilio' : 'Recojo en el local'}
            </button>
          ))}
        </div>
        {delivery ? (
          <label className="mt-4 block text-[14px] font-semibold">Dirección
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={field} style={{ borderColor: t.muted, background: t.surface, color: t.text }} />
          </label>
        ) : null}
        <a href={wa(m.whatsapp, text)} className="mt-6 block rounded-[12px] bg-[#25d366] px-5 py-4 text-center text-[16px] font-bold text-[#06210f]">
          Enviar pedido por WhatsApp
        </a>
        <p className="mt-3 text-center text-[12.5px]" style={{ color: t.muted }}>El pedido llega ya escrito al WhatsApp de {m.name}.</p>
      </div>
    </div>
  );
}

function Turnos({ m, display }: { m: Muestra; display: React.CSSProperties }) {
  const t = m.theme;
  const days = useMemo(nextDays, []);
  const services = m.sections[0].items;
  const [picked, setPicked] = useState<string[]>([]);
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState('');
  const [name, setName] = useState('');
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const ready = picked.length > 0 && slot;
  const text = `Hola ${m.name}, quiero un turno.\nServicio: ${picked.join(', ')}\nDía: ${days[day]}\nHora: ${slot}${name ? `\nA nombre de: ${name}` : ''}`;
  const chip = (on: boolean) => (on ? { background: t.accent, color: t.onAccent, borderColor: t.accent } : { borderColor: t.muted, background: t.surface });
  return (
    <div className="mt-8 grid grid-cols-1 gap-8 [&>*]:min-w-0">
      <div>
        <h3 className="text-[22px] leading-none" style={display}>1. Escoge el servicio</h3>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.name}>
              <button type="button" onClick={() => toggle(s.name)} className="w-full rounded-[12px] border p-4 text-left" style={chip(picked.includes(s.name))}>
                <span className="block text-[16px] font-bold">{s.name}</span>
                <span className="block text-[13.5px] opacity-80">{s.desc}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-[22px] leading-none" style={display}>2. El día</h3>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {days.map((d, i) => (
            <button key={d} type="button" onClick={() => setDay(i)} className="shrink-0 rounded-[10px] border px-4 py-3 text-[14px] font-bold" style={chip(day === i)}>{d}</button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-[22px] leading-none" style={display}>3. La hora</h3>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {SLOTS.map((s) => (
            <button key={s} type="button" onClick={() => setSlot(s)} className="rounded-[10px] border px-2 py-3 text-[14px] font-bold" style={chip(slot === s)}>{s}</button>
          ))}
        </div>
        <label className="mt-5 block max-w-[420px] text-[14px] font-semibold">Tu nombre
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} style={{ borderColor: t.muted, background: t.surface, color: t.text }} />
        </label>
      </div>
      <a
        href={ready ? wa(m.whatsapp, text) : undefined}
        aria-disabled={!ready}
        className={`block max-w-[420px] rounded-[12px] px-5 py-4 text-center text-[16px] font-bold ${ready ? 'bg-[#25d366] text-[#06210f]' : 'cursor-not-allowed opacity-50'}`}
        style={ready ? undefined : { background: t.surface }}
      >
        {ready ? 'Pedir turno por WhatsApp' : 'Escoge servicio y hora'}
      </a>
    </div>
  );
}

function Reserva({ m }: { m: Muestra }) {
  const t = m.theme;
  const days = useMemo(nextDays, []);
  const [people, setPeople] = useState(2);
  const [day, setDay] = useState(0);
  const [time, setTime] = useState('7:00 p. m.');
  const [name, setName] = useState('');
  const text = `Hola ${m.name}, quiero reservar una mesa.\nPersonas: ${people}\nDía: ${days[day]}\nHora: ${time}${name ? `\nA nombre de: ${name}` : ''}`;
  const style = { borderColor: t.muted, background: t.surface, color: t.text };
  return (
    <div className="mt-6 grid max-w-[520px] gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[14px] font-semibold">Personas
          <select value={people} onChange={(e) => setPeople(Number(e.target.value))} className={field} style={style}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="block text-[14px] font-semibold">Hora
          <select value={time} onChange={(e) => setTime(e.target.value)} className={field} style={style}>
            {['12:00 m.', '1:00 p. m.', '2:00 p. m.', '6:00 p. m.', '7:00 p. m.', '8:00 p. m.'].map((h) => <option key={h}>{h}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-[14px] font-semibold">Día
        <select value={day} onChange={(e) => setDay(Number(e.target.value))} className={field} style={style}>
          {days.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </label>
      <label className="block text-[14px] font-semibold">Tu nombre
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} style={style} />
      </label>
      <a href={wa(m.whatsapp, text)} className="block rounded-[12px] bg-[#25d366] px-5 py-4 text-center text-[16px] font-bold text-[#06210f]">
        Reservar por WhatsApp
      </a>
      <p className="text-[12.5px]" style={{ color: t.muted }}>La reserva llega ya escrita al WhatsApp de {m.name}, que te confirma.</p>
    </div>
  );
}
