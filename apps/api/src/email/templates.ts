import { escapeHtml, sanitizeHeader } from './escape.js';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const money = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency}`;

/** Envoltorio común: tarjeta blanca centrada, letra del sistema, marca "3R" arriba. */
function layout(bodyHtml: string, bodyText: string): { html: string; text: string } {
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:32px 16px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;">
<tr><td style="padding:28px 32px 0">
<span style="font-weight:800;font-size:20px;letter-spacing:-0.02em;color:#111827;">3R</span>
</td></tr>
<tr><td style="padding:16px 32px 32px;font-size:15px;line-height:1.6;">
${bodyHtml}
</td></tr>
</table>
<p style="max-width:520px;margin:16px auto 0;text-align:center;font-size:12px;color:#9ca3af;">3R — Páginas web para negocios</p>
</body>
</html>`;
  const text = `3R\n\n${bodyText}\n\n—\n3R — Páginas web para negocios`;
  return { html, text };
}

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#5b6cff;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">${escapeHtml(label)}</a>`;

const greeting = (firstName?: string | null) => `Hola${firstName ? ` ${escapeHtml(firstName)}` : ''},`;

// ───────── al cliente ─────────

export function welcome(data: { firstName?: string | null; verifyUrl: string }): RenderedEmail {
  const { html, text } = layout(
    `<p>${greeting(data.firstName)}</p>
     <p>Gracias por crear tu cuenta en 3R. Desde aquí puedes pedir tu página web y seguir el avance de tu pedido.</p>
     <p>Confirma tu correo para poder hacer pedidos:</p>
     ${button(data.verifyUrl, 'Confirmar mi correo')}
     <p style="margin-top:24px;font-size:13px;color:#6b7280;">Si el botón no funciona, copia y pega este enlace:<br>${escapeHtml(data.verifyUrl)}</p>`,
    `${greeting(data.firstName)}\n\nGracias por crear tu cuenta en 3R. Confirma tu correo en este enlace para poder hacer pedidos:\n${data.verifyUrl}`,
  );
  return { subject: 'Bienvenido a 3R — confirma tu correo', html, text };
}

export function verifyEmail(data: { firstName?: string | null; verifyUrl: string }): RenderedEmail {
  const { html, text } = layout(
    `<p>${greeting(data.firstName)}</p>
     <p>Confirma tu correo para poder hacer pedidos en 3R:</p>
     ${button(data.verifyUrl, 'Confirmar mi correo')}
     <p style="margin-top:24px;font-size:13px;color:#6b7280;">Este enlace vale por 3 días. Si el botón no funciona, copia y pega:<br>${escapeHtml(data.verifyUrl)}</p>`,
    `${greeting(data.firstName)}\n\nConfirma tu correo en este enlace (vale 3 días):\n${data.verifyUrl}`,
  );
  return { subject: 'Confirma tu correo — 3R', html, text };
}

export function passwordReset(data: { firstName?: string | null; resetUrl: string }): RenderedEmail {
  const { html, text } = layout(
    `<p>${greeting(data.firstName)}</p>
     <p>Pediste cambiar tu contraseña. Si fuiste tú, elige una nueva aquí:</p>
     ${button(data.resetUrl, 'Cambiar mi contraseña')}
     <p style="margin-top:24px;font-size:13px;color:#6b7280;">Este enlace vale 1 hora y solo funciona una vez. Si no fuiste tú, ignora este correo: tu contraseña sigue igual.</p>`,
    `${greeting(data.firstName)}\n\nPara cambiar tu contraseña, entra a este enlace (vale 1 hora):\n${data.resetUrl}\n\nSi no fuiste tú, ignora este correo.`,
  );
  return { subject: 'Recuperar tu contraseña — 3R', html, text };
}

export function passwordChanged(data: { firstName?: string | null }): RenderedEmail {
  const { html, text } = layout(
    `<p>${greeting(data.firstName)}</p>
     <p>Tu contraseña de 3R se cambió correctamente. Por seguridad, cerramos tu sesión en todos los dispositivos.</p>
     <p style="margin-top:16px;font-size:13px;color:#6b7280;">Si no fuiste tú, escríbenos de inmediato respondiendo este correo.</p>`,
    `${greeting(data.firstName)}\n\nTu contraseña de 3R se cambió correctamente. Cerramos tu sesión en todos los dispositivos.\n\nSi no fuiste tú, escríbenos de inmediato.`,
  );
  return { subject: 'Tu contraseña cambió — 3R', html, text };
}

export function orderUpdate(data: { firstName?: string | null; orderCode: string; lines: string[]; orderUrl: string }): RenderedEmail {
  const items = data.lines.map((line) => `<li style="margin-bottom:4px;">${escapeHtml(line)}</li>`).join('');
  const { html, text } = layout(
    `<p>${greeting(data.firstName)}</p>
     <p>Tu pedido <strong>${escapeHtml(data.orderCode)}</strong> tiene novedades:</p>
     <ul style="padding-left:20px;margin:12px 0;">${items}</ul>
     ${button(data.orderUrl, 'Ver mi pedido')}`,
    `${greeting(data.firstName)}\n\nTu pedido ${data.orderCode} tiene novedades:\n${data.lines.map((l) => `- ${l}`).join('\n')}\n\nVerlo aquí: ${data.orderUrl}`,
  );
  return { subject: `Novedades en tu pedido ${sanitizeHeader(data.orderCode, 30)} — 3R`, html, text };
}

export function orderDelivered(data: { firstName?: string | null; orderCode: string; deliveryUrl: string; orderUrl: string }): RenderedEmail {
  const { html, text } = layout(
    `<p>${greeting(data.firstName)}</p>
     <p>¡Tu página ya está lista! Puedes verla aquí:</p>
     ${button(data.deliveryUrl, 'Ver mi página')}
     <p style="margin-top:20px;">También puedes revisar los detalles de tu pedido <strong>${escapeHtml(data.orderCode)}</strong> en <a href="${escapeHtml(data.orderUrl)}" style="color:#5b6cff;">tu cuenta</a>.</p>`,
    `${greeting(data.firstName)}\n\n¡Tu página ya está lista!\n${data.deliveryUrl}\n\nDetalles de tu pedido ${data.orderCode}: ${data.orderUrl}`,
  );
  return { subject: '¡Tu página web ya está lista! — 3R', html, text };
}

export function clientMessage(data: { firstName?: string | null; orderCode: string; body: string; orderUrl: string }): RenderedEmail {
  const { html, text } = layout(
    `<p>${greeting(data.firstName)}</p>
     <p>Tienes un mensaje nuevo sobre tu pedido <strong>${escapeHtml(data.orderCode)}</strong>:</p>
     <p style="background:#f4f5f7;border-radius:12px;padding:14px 16px;white-space:pre-wrap;">${escapeHtml(data.body)}</p>
     ${button(data.orderUrl, 'Responder')}`,
    `${greeting(data.firstName)}\n\nTienes un mensaje nuevo sobre tu pedido ${data.orderCode}:\n"${data.body}"\n\nResponde aquí: ${data.orderUrl}`,
  );
  return { subject: `Nuevo mensaje sobre tu pedido ${sanitizeHeader(data.orderCode, 30)} — 3R`, html, text };
}

// ───────── al equipo (administrador) ─────────

export function adminNewSignup(data: { email: string; firstName?: string | null }): RenderedEmail {
  const { html, text } = layout(
    `<p>Se registró una cuenta nueva en 3R.</p>
     <p><strong>Nombre:</strong> ${escapeHtml(data.firstName || '—')}<br><strong>Correo:</strong> ${escapeHtml(data.email)}</p>`,
    `Se registró una cuenta nueva en 3R.\nNombre: ${data.firstName || '—'}\nCorreo: ${data.email}`,
  );
  return { subject: 'Cuenta nueva registrada — 3R', html, text };
}

export function adminNewOrder(data: {
  orderCode: string;
  businessName: string;
  packageName: string;
  clientEmail: string;
  priceCents: number;
  currency: string;
  adminUrl: string;
}): RenderedEmail {
  const { html, text } = layout(
    `<p>Nuevo pedido: <strong>${escapeHtml(data.orderCode)}</strong></p>
     <p><strong>Negocio:</strong> ${escapeHtml(data.businessName)}<br>
     <strong>Paquete:</strong> ${escapeHtml(data.packageName)} (${money(data.priceCents, data.currency)})<br>
     <strong>Cliente:</strong> ${escapeHtml(data.clientEmail)}</p>
     ${button(data.adminUrl, 'Ver pedido')}`,
    `Nuevo pedido: ${data.orderCode}\nNegocio: ${data.businessName}\nPaquete: ${data.packageName} (${money(data.priceCents, data.currency)})\nCliente: ${data.clientEmail}\n\n${data.adminUrl}`,
  );
  return { subject: `Nuevo pedido ${sanitizeHeader(data.orderCode, 30)} — ${sanitizeHeader(data.businessName, 60)}`, html, text };
}

export function adminNewMessage(data: { orderCode: string; businessName: string; body: string; adminUrl: string }): RenderedEmail {
  const { html, text } = layout(
    `<p>Mensaje nuevo del cliente en el pedido <strong>${escapeHtml(data.orderCode)}</strong> (${escapeHtml(data.businessName)}):</p>
     <p style="background:#f4f5f7;border-radius:12px;padding:14px 16px;white-space:pre-wrap;">${escapeHtml(data.body)}</p>
     ${button(data.adminUrl, 'Responder')}`,
    `Mensaje nuevo del cliente en el pedido ${data.orderCode} (${data.businessName}):\n"${data.body}"\n\n${data.adminUrl}`,
  );
  return { subject: `Mensaje de ${sanitizeHeader(data.businessName, 50)} — ${sanitizeHeader(data.orderCode, 30)}`, html, text };
}

// ───────── formulario de contacto de una página publicada ─────────

export function siteContactMessage(data: {
  siteName: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
}): RenderedEmail {
  const { html, text } = layout(
    `<p>Alguien escribió desde el formulario de contacto de <strong>${escapeHtml(data.siteName)}</strong>:</p>
     <p><strong>Nombre:</strong> ${escapeHtml(data.name)}<br>
     <strong>Correo:</strong> ${escapeHtml(data.email)}${data.phone ? `<br><strong>Teléfono:</strong> ${escapeHtml(data.phone)}` : ''}</p>
     <p style="background:#f4f5f7;border-radius:12px;padding:14px 16px;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
     <p style="color:#6b7280;font-size:13px;">Puedes responder directo a este correo — llega a ${escapeHtml(data.email)}.</p>`,
    `Alguien escribió desde el formulario de contacto de ${data.siteName}:\nNombre: ${data.name}\nCorreo: ${data.email}${data.phone ? `\nTeléfono: ${data.phone}` : ''}\n\n"${data.message}"\n\nPuedes responder directo a este correo.`,
  );
  return { subject: `Nuevo mensaje desde ${sanitizeHeader(data.siteName, 60)}`, html, text };
}

/** Al visitante: confirma que su mensaje llegó, sin prometer un tiempo de respuesta que no controlamos. */
export function siteContactAutoReply(data: { siteName: string; name: string }): RenderedEmail {
  const { html, text } = layout(
    `<p>${greeting(data.name)}</p>
     <p>Gracias por escribirle a <strong>${escapeHtml(data.siteName)}</strong>. Ya recibimos tu mensaje y te van a responder pronto.</p>
     <p style="color:#6b7280;font-size:13px;">Este es un aviso automático — puedes responder directo a este correo si quieres agregar algo.</p>`,
    `${greeting(data.name)}\n\nGracias por escribirle a ${data.siteName}. Ya recibimos tu mensaje y te van a responder pronto.\n\n(Aviso automático — puedes responder directo a este correo.)`,
  );
  return { subject: `Ya recibimos tu mensaje — ${sanitizeHeader(data.siteName, 60)}`, html, text };
}
