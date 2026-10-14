/*
 * Envío de correos: transporte SMTP, modo prueba y plantillas.
 * Si no hay SMTP configurado, los correos se guardan en data/outbox para
 * revisarlos desde el panel (modo prueba) en lugar de enviarse.
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const store = require('./store');

const OUTBOX = path.join(store.DATA_DIR, 'outbox');
const OUTBOX_KEEP = 200;

/* ---------- Configuración ---------- */

// Las variables de entorno tienen prioridad sobre lo guardado en el panel.
function mailConfig() {
  const m = store.get().settings.mail;
  const env = process.env;
  return {
    ...m,
    smtpHost: env.SMTP_HOST || m.smtpHost,
    smtpPort: Number(env.SMTP_PORT || m.smtpPort || 587),
    smtpSecure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : !!m.smtpSecure,
    smtpUser: env.SMTP_USER || m.smtpUser,
    smtpPass: env.SMTP_PASS || m.smtpPass,
    fromEmail: env.MAIL_FROM || m.fromEmail || env.SMTP_USER || m.smtpUser,
    publicUrl: (env.PUBLIC_URL || m.publicUrl || '').replace(/\/+$/, ''),
  };
}

const isTestMode = () => !mailConfig().smtpHost;

let cached = { key: '', transport: null };
function transport() {
  const c = mailConfig();
  const key = [c.smtpHost, c.smtpPort, c.smtpSecure, c.smtpUser, c.smtpPass].join('|');
  if (cached.key !== key) {
    if (cached.transport) cached.transport.close();
    cached = {
      key,
      transport: nodemailer.createTransport({
        host: c.smtpHost,
        port: c.smtpPort,
        secure: c.smtpSecure,
        auth: c.smtpUser ? { user: c.smtpUser, pass: c.smtpPass } : undefined,
        pool: true,
        maxConnections: 1,
      }),
    };
  }
  return cached.transport;
}

async function verify() {
  if (isTestMode()) return { ok: true, testMode: true };
  await transport().verify();
  return { ok: true, testMode: false };
}

/* ---------- Envío ---------- */

async function send({ to, subject, html, text, headers, attachments, kind }) {
  const c = mailConfig();
  const domain = (c.fromEmail || 'localhost').split('@')[1] || 'localhost';
  const msg = {
    from: { name: c.fromName || 'Mangos Espaciales', address: c.fromEmail || 'no-reply@localhost' },
    to,
    subject,
    html,
    text,
    replyTo: c.replyTo || undefined,
    headers: headers || {},
    attachments: attachments || [],
    messageId: `<${store.token()}.${Date.now()}@${domain}>`,
  };

  if (isTestMode()) {
    saveToOutbox({ to, subject, html, text, kind, attachments });
    return { testMode: true, messageId: msg.messageId };
  }
  const info = await transport().sendMail(msg);
  return { testMode: false, messageId: info.messageId, response: info.response };
}

function saveToOutbox({ to, subject, html, text, kind, attachments }) {
  fs.mkdirSync(OUTBOX, { recursive: true });
  // las imágenes adjuntas (QR) se incrustan para poder ver el correo en el panel
  let preview = html;
  for (const a of attachments || []) {
    if (a.cid && a.content) preview = preview.split(`cid:${a.cid}`).join(`data:image/png;base64,${a.content.toString('base64')}`);
  }
  const name = `${Date.now()}_${store.token().slice(0, 6)}.json`;
  fs.writeFileSync(path.join(OUTBOX, name), JSON.stringify({ to, subject, text, html: preview, kind, date: new Date().toISOString() }));
  const files = fs.readdirSync(OUTBOX).sort();
  files.slice(0, Math.max(0, files.length - OUTBOX_KEEP)).forEach((f) => fs.unlinkSync(path.join(OUTBOX, f)));
}

function listOutbox(limit = 40) {
  if (!fs.existsSync(OUTBOX)) return [];
  return fs
    .readdirSync(OUTBOX)
    .sort()
    .reverse()
    .slice(0, limit)
    .map((f) => {
      const m = JSON.parse(fs.readFileSync(path.join(OUTBOX, f), 'utf8'));
      return { id: f.replace('.json', ''), to: m.to, subject: m.subject, kind: m.kind, date: m.date };
    });
}

function readOutbox(id) {
  const file = path.join(OUTBOX, path.basename(id) + '.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/* ---------- Utilidades de texto ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// {Hola|Qué más|Epa} → elige una opción al azar. Admite anidación.
function spin(s) {
  let prev;
  do {
    prev = s;
    s = s.replace(/\{([^{}]*\|[^{}]*)\}/g, (_, opts) => {
      const list = opts.split('|');
      return list[Math.floor(Math.random() * list.length)];
    });
  } while (s !== prev);
  return s;
}

function firstName(name, fallback) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  if (!first) return fallback;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

const fill = (s, vars) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));

/* ---------- Fechas (hora de Colombia, UTC-5) ---------- */

const eventStart = (ev) => new Date(`${ev.date}:00-05:00`);
function fmtDate(ev) {
  const d = eventStart(ev);
  const opts = { timeZone: 'America/Bogota' };
  const day = d.toLocaleDateString('es-CO', { ...opts, weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('es-CO', { ...opts, hour: 'numeric', minute: '2-digit' });
  return { day: day.charAt(0).toUpperCase() + day.slice(1), time };
}

function calendarUrl(ev, publicUrl) {
  const start = eventStart(ev);
  const end = new Date(start.getTime() + 6 * 36e5);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(`${ev.title} ${ev.edition}`)}` +
    `&dates=${f(start)}/${f(end)}` +
    `&location=${encodeURIComponent(`${ev.venue}, ${ev.address}`)}` +
    `&details=${encodeURIComponent(`Organiza ${ev.organizer}. ${publicUrl ? publicUrl + '/after' : ''}`)}`
  );
}

const mapsUrl = (ev) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ev.venue} ${ev.venueDetail} ${ev.address}`)}`;
const waUrl = (ev, text) => `https://wa.me/${String(ev.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

/* ---------- Plantilla base ---------- */

const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

function button(href, label, color = '#E2231A') {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;"><tr>
    <td style="border-radius:12px;background:${color};">
      <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px;">${esc(label)}</a>
    </td></tr></table>`;
}

function layout({ preheader, body, footer }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title></title></head>
<body style="margin:0;padding:0;background:#F4EBD9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EBD9;"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
    <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="50%" style="height:6px;background:#FCD116;font-size:0;line-height:0;">&nbsp;</td>
      <td width="25%" style="height:6px;background:#003893;font-size:0;line-height:0;">&nbsp;</td>
      <td width="25%" style="height:6px;background:#CE1126;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table></td></tr>
    <tr><td style="padding:28px 32px 30px;font-family:${FONT};font-size:16px;line-height:1.6;color:#1B1530;">${body}</td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr>
    <td style="padding:18px 24px;font-family:${FONT};font-size:12px;line-height:1.6;color:#7A6F63;text-align:center;">${footer}</td>
  </tr></table>
</td></tr></table>
</body></html>`;
}

function eventDetailsHtml(ev) {
  const { day, time } = fmtDate(ev);
  const row = (label, value) =>
    `<tr><td style="padding:8px 0;color:#7A6F63;font-size:14px;width:90px;">${label}</td><td style="padding:8px 0;font-weight:bold;font-size:15px;">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-top:1px solid #EFE6D6;border-bottom:1px solid #EFE6D6;">
    ${row('Fecha', esc(day))}${row('Hora', esc(time))}${row('Lugar', `${esc(ev.venue)} · ${esc(ev.venueDetail)}<br><span style="font-weight:normal;color:#7A6F63;font-size:13px;">${esc(ev.address)}</span>`)}
  </table>`;
}

function codeBlock(codeText, label) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#FFF6DA;border:2px dashed #E2231A;border-radius:14px;">
    <tr><td align="center" style="padding:18px;">
      <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7A6F63;">${esc(label)}</div>
      <div style="font-size:28px;font-weight:bold;letter-spacing:3px;color:#E2231A;margin:4px 0 12px;">${esc(codeText)}</div>
      <img src="cid:qr@after" width="180" height="180" alt="Código QR ${esc(codeText)}" style="display:block;border:0;">
    </td></tr></table>`;
}

const transactionalFooter = (ev) =>
  `Organiza ${esc(ev.organizer)} · ${esc(mailConfig().physicalAddress)}<br>¿Dudas? Escríbenos por <a href="${esc(waUrl(ev, 'Hola, tengo una pregunta sobre el evento'))}" style="color:#7A6F63;">WhatsApp</a>.`;

async function qrAttachment(text) {
  const content = await QRCode.toBuffer(text, { margin: 1, width: 360, color: { dark: '#1B1530', light: '#FFFFFF' } });
  return { filename: 'codigo-qr.png', content, cid: 'qr@after', contentType: 'image/png' };
}

/* ---------- Correos transaccionales ---------- */

async function registrationEmail(reg, ev) {
  const pub = mailConfig().publicUrl;
  const name = firstName(reg.name, '');
  const body = `
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#E2231A;font-weight:bold;">${esc(ev.organizer)} presenta</div>
    <h1 style="margin:6px 0 4px;font-size:26px;line-height:1.2;">${esc(ev.title)} <span style="color:#E2231A;">${esc(ev.edition)}</span></h1>
    <p style="margin:0 0 16px;color:#7A6F63;">${esc(ev.city)} · ${esc(ev.tagline)}</p>
    <p style="margin:0 0 8px;font-size:18px;"><strong>¡Listo${name ? ', ' + esc(name) : ''}! Tu entrada quedó registrada.</strong></p>
    <p style="margin:0;">Tu ingreso es <strong>sin costo</strong>. Presenta este código QR y tu documento en la entrada.</p>
    ${codeBlock(reg.code, 'Tu código de ingreso')}
    ${eventDetailsHtml(ev)}
    ${button(calendarUrl(ev, pub), 'Agregar a mi calendario', '#003893')}
    ${button(mapsUrl(ev), 'Cómo llegar', '#1B1530')}
    <p style="margin:18px 0 0;font-size:14px;color:#7A6F63;">El ingreso está sujeto al aforo del lugar: te recomendamos llegar temprano. Cada persona debe tener su propia inscripción.</p>`;
  const text = `¡Listo${name ? ', ' + name : ''}! Tu entrada sin costo para ${ev.title} ${ev.edition} quedó registrada.
Código de ingreso: ${reg.code}
${fmtDate(ev).day} · ${fmtDate(ev).time}
${ev.venue} · ${ev.venueDetail}, ${ev.address}
Presenta tu código QR y tu documento en la entrada.`;
  return {
    to: reg.email,
    subject: `Tu entrada para ${ev.title} · ${reg.code}`,
    html: layout({ preheader: `Código ${reg.code} · ${fmtDate(ev).day}, ${fmtDate(ev).time}`, body, footer: transactionalFooter(ev) }),
    text,
    attachments: [await qrAttachment(reg.code)],
    kind: 'inscripcion',
  };
}

async function tableEmail(t, ev) {
  const pub = mailConfig().publicUrl;
  const name = firstName(t.name, '');
  const body = `
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#E2231A;font-weight:bold;">Reserva de mesa</div>
    <h1 style="margin:6px 0 4px;font-size:26px;line-height:1.2;">Mesa ${esc(t.table)} reservada</h1>
    <p style="margin:0 0 16px;color:#7A6F63;">${esc(ev.title)} ${esc(ev.edition)} · ${esc(ev.city)}</p>
    <p style="margin:0 0 8px;font-size:18px;"><strong>¡Qué bien${name ? ', ' + esc(name) : ''}! Ya tienes tu mesa.</strong></p>
    <p style="margin:0;">Mesa <strong>#${esc(t.table)}</strong> para <strong>${esc(t.people)} personas</strong>.</p>
    ${codeBlock(t.code, 'Código de tu mesa')}
    ${eventDetailsHtml(ev)}
    <p style="margin:0 0 12px;padding:12px 14px;background:#F4EBD9;border-radius:10px;font-size:14px;">${esc(ev.tableConditions)}</p>
    <p style="margin:0 0 6px;">La entrada es <strong>sin costo</strong>, pero <strong>cada acompañante debe inscribirse</strong> para el control de aforo:</p>
    ${pub ? button(`${pub}/after#registro`, 'Inscribir a mis acompañantes', '#E2231A') : ''}
    ${button(calendarUrl(ev, pub), 'Agregar a mi calendario', '#003893')}`;
  const text = `¡Ya tienes tu mesa${name ? ', ' + name : ''}!
Mesa #${t.table} para ${t.people} personas · Código ${t.code}
${ev.title} ${ev.edition} · ${fmtDate(ev).day} · ${fmtDate(ev).time}
${ev.venue} · ${ev.venueDetail}, ${ev.address}
${ev.tableConditions}
Cada acompañante debe inscribirse sin costo${pub ? ' en ' + pub + '/after' : ''}.`;
  return {
    to: t.email,
    subject: `Mesa ${t.table} reservada · ${ev.title} · ${t.code}`,
    html: layout({ preheader: `Mesa #${t.table} para ${t.people} personas · ${fmtDate(ev).day}`, body, footer: transactionalFooter(ev) }),
    text,
    attachments: [await qrAttachment(t.code)],
    kind: 'mesa',
  };
}

/* ---------- Invitación (campañas) ---------- */

// Arma una variación distinta del correo para cada contacto.
function invitationEmail(campaign, contact, ev) {
  const c = mailConfig();
  const pub = c.publicUrl;
  const vars = {
    nombre: firstName(contact.name, campaign.fallbackName || 'pana'),
    evento: ev.title,
    ciudad: ev.city,
    fecha: fmtDate(ev).day,
    hora: fmtDate(ev).time,
    lugar: `${ev.venue} ${ev.venueDetail}`.trim(),
  };
  const pick = (list) => {
    const items = String(list || '').split('\n').map((s) => s.trim()).filter(Boolean);
    return items.length ? items[Math.floor(Math.random() * items.length)] : '';
  };
  const render = (s) => fill(spin(s), vars);

  const subject = render(pick(campaign.subjects) || '{{evento}}');
  const preheader = render(pick(campaign.preheaders));
  const paragraphs = render(campaign.body || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const ctaText = render(campaign.ctaText || 'Quiero inscribirme');
  const link = pub ? `${pub}/r/${contact.token}/${campaign.id}` : campaign.ctaUrl;
  const unsub = pub ? `${pub}/u/${contact.token}` : '';
  const poster = campaign.includePoster && pub ? `${pub}/assets/after/afiche-evento.jpg` : '';

  const body = `
    ${paragraphs.map((p) => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}
    ${poster ? `<a href="${esc(link)}" target="_blank"><img src="${esc(poster)}" width="496" alt="${esc(ev.title)} ${esc(ev.edition)} en ${esc(ev.city)}" style="display:block;width:100%;max-width:496px;height:auto;border:0;border-radius:12px;margin:6px 0 14px;"></a>` : ''}
    ${button(link, ctaText)}
    <p style="margin:16px 0 0;font-size:14px;color:#7A6F63;">${esc(vars.fecha)} · ${esc(vars.hora)} · ${esc(vars.lugar)}, ${esc(ev.city)}</p>
    <p style="margin:18px 0 0;">${esc(render(campaign.signature || 'Un abrazo,\nEquipo Mangos Espaciales')).replace(/\n/g, '<br>')}</p>`;

  const footer = `Te escribimos porque haces parte de la comunidad de ${esc(ev.organizer)}.<br>
    ${unsub ? `Si no quieres recibir más invitaciones, <a href="${esc(unsub)}" style="color:#7A6F63;">date de baja aquí</a>.<br>` : ''}
    ${esc(ev.organizer)} · ${esc(c.physicalAddress)}`;

  const text = [...paragraphs, `${ctaText}: ${link}`, `${vars.fecha} · ${vars.hora} · ${vars.lugar}, ${ev.city}`, render(campaign.signature || 'Un abrazo,\nEquipo Mangos Espaciales'), unsub ? `Darte de baja: ${unsub}` : '']
    .filter(Boolean)
    .join('\n\n');

  const headers = { 'X-Entity-Ref-ID': store.token() };
  if (unsub) {
    const mailto = c.replyTo || c.fromEmail;
    headers['List-Unsubscribe'] = `<${unsub}>${mailto ? `, <mailto:${mailto}?subject=Baja>` : ''}`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { to: contact.email, subject, html: layout({ preheader, body, footer }), text, headers, kind: 'campaña' };
}

module.exports = {
  mailConfig,
  isTestMode,
  verify,
  send,
  listOutbox,
  readOutbox,
  registrationEmail,
  tableEmail,
  invitationEmail,
  fmtDate,
  eventStart,
  esc,
};
