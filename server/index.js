/*
 * Servidor de Mangos Espaciales.
 * - Sirve el sitio (páginas HTML, estilos, imágenes).
 * - API pública: inscripción gratuita, reserva de mesas, seguimiento de enlaces y bajas.
 * - API del panel: inscritos, mesas, ingreso, CRM, campañas y ajustes.
 */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const QRCode = require('qrcode');
const store = require('./store');
const mail = require('./mail');
const crm = require('./crm');
const campaigns = require('./campaign');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;

store.load();
const db = () => store.get();
const ev = () => db().settings.event;

/* ---------- Contraseña del panel ---------- */
if (!process.env.ADMIN_PASSWORD && !db().settings.adminPassword) {
  db().settings.adminPassword = crypto.randomBytes(6).toString('base64url');
  store.save();
}
const adminPassword = () => process.env.ADMIN_PASSWORD || db().settings.adminPassword;

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
// las bases de contactos pueden ser grandes; el resto de peticiones son pequeñas
app.use('/api/admin/contacts/import', express.json({ limit: '15mb' }));
app.use('/api/admin/uploads', express.json({ limit: '5mb' }));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false }));

/* ---------- Utilidades ---------- */

const DOC_TYPES = ['CC', 'CE', 'TI', 'PPT', 'Pasaporte', 'Cédula venezolana'];
const activeRegs = () => db().registrations.filter((r) => r.status !== 'cancelada');
const activeTables = () => db().tables.filter((t) => t.status !== 'cancelada');

const fail = (res, status, message) => res.status(status).json({ error: message });

// Límite sencillo por IP para los formularios públicos.
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    const list = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return fail(res, 429, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
    list.push(now);
    hits.set(req.ip, list);
    next();
  };
}
setInterval(() => hits.clear(), 30 * 60 * 1000).unref();

function readPerson(body) {
  const p = {
    name: crm.cleanText(body.name, 80),
    docType: DOC_TYPES.includes(body.docType) ? body.docType : 'CC',
    doc: String(body.doc || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 15),
    phone: crm.cleanPhone(body.phone),
    email: crm.normEmail(body.email),
    city: crm.cleanText(body.city, 60),
    ref: String(body.ref || '').slice(0, 20),
  };
  if (p.name.length < 3) return { error: 'Escribe tu nombre completo.' };
  if (p.doc.length < 4) return { error: 'Escribe un número de documento válido.' };
  if (p.phone.replace(/\D/g, '').length < 7) return { error: 'Escribe un número de celular válido.' };
  if (!crm.validEmail(p.email)) return { error: 'Escribe un correo electrónico válido.' };
  if (body.consent !== true) return { error: 'Debes aceptar el tratamiento de datos para inscribirte.' };
  return { person: p };
}

// Envía el correo sin hacer esperar al usuario y deja registro del resultado.
function sendInBackground(record, build) {
  record.emailStatus = 'enviando';
  build(record, ev())
    .then((email) => mail.send(email))
    .then((info) => {
      record.emailStatus = info.testMode ? 'modo prueba' : 'enviado';
    })
    .catch((err) => {
      record.emailStatus = 'error';
      record.emailError = String(err.message || err).slice(0, 200);
      console.error('[correo]', record.code, err.message);
    })
    .finally(() => store.save());
}

// Atribuye la inscripción a la última campaña que recibió el contacto.
function attribute(contact, wasStage) {
  if (['registrado', 'mesa'].includes(wasStage)) return;
  const sent = Object.entries(contact.sent || {}).filter(([, d]) => d !== 'error').sort((a, b) => b[1].localeCompare(a[1]));
  const camp = sent.length && db().campaigns.find((c) => c.id === sent[0][0]);
  if (camp) camp.stats.registered++;
}

const qrDataUrl = (text) => QRCode.toDataURL(text, { margin: 1, width: 320, color: { dark: '#1B1530', light: '#FFFFFF' } });

/* ================= API pública ================= */

app.get('/api/public/event', (req, res) => {
  const e = ev();
  res.json({
    event: {
      title: e.title,
      edition: e.edition,
      city: e.city,
      tagline: e.tagline,
      subtitle: e.subtitle,
      date: e.date,
      venue: e.venue,
      venueDetail: e.venueDetail,
      address: e.address,
      whatsapp: e.whatsapp,
      instagram: e.instagram,
      organizer: e.organizer,
      lineup: e.lineup,
      tableCount: e.tableCount,
      tableSeats: e.tableSeats,
      tableConditions: e.tableConditions,
      registrationOpen: e.registrationOpen,
      tablesOpen: e.tablesOpen,
    },
    tablesTaken: activeTables().map((t) => t.table),
    sponsors: (db().settings.sponsors || []).filter((s) => s.active !== false),
    sponsorConfig: db().settings.sponsorConfig,
  });
});

app.post('/api/public/register', rateLimit(15, 10 * 60 * 1000), async (req, res) => {
  const e = ev();
  if (!e.registrationOpen) return fail(res, 403, 'Las inscripciones están cerradas.');
  const { person, error } = readPerson(req.body);
  if (error) return fail(res, 400, error);

  const dup = activeRegs().find((r) => r.doc === person.doc);
  if (dup) {
    if (dup.email !== person.email) return fail(res, 409, 'Este documento ya está inscrito. Si es tuyo, escríbenos por WhatsApp y te ayudamos.');
    sendInBackground(dup, mail.registrationEmail); // le reenviamos su código
    return res.json({ code: dup.code, name: dup.name, email: dup.email, qr: await qrDataUrl(dup.code), existing: true });
  }

  const contact = crm.byToken(person.ref) || crm.byEmail(person.email);
  const wasStage = contact && contact.stage;
  const c = crm.linkSignup(person, 'registrado', 'Se inscribió al evento (entrada gratis)');
  attribute(c, wasStage);

  const reg = {
    id: store.id(),
    code: store.code('AFT'),
    ...person,
    contactId: c.id,
    status: 'activa',
    checkedInAt: null,
    createdAt: new Date().toISOString(),
  };
  db().registrations.push(reg);
  store.save();
  sendInBackground(reg, mail.registrationEmail);
  res.json({ code: reg.code, name: reg.name, email: reg.email, qr: await qrDataUrl(reg.code) });
});

app.post('/api/public/table', rateLimit(10, 10 * 60 * 1000), async (req, res) => {
  const e = ev();
  if (!e.tablesOpen) return fail(res, 403, 'La reserva de mesas está cerrada.');
  const { person, error } = readPerson(req.body);
  if (error) return fail(res, 400, error);
  const table = Number(req.body.table);
  const people = Number(req.body.people);
  if (!Number.isInteger(table) || table < 1 || table > e.tableCount) return fail(res, 400, 'Elige una mesa del mapa.');
  if (!Number.isInteger(people) || people < 1 || people > e.tableSeats) return fail(res, 400, `Cada mesa es para máximo ${e.tableSeats} personas.`);
  if (activeTables().some((t) => t.table === table)) return fail(res, 409, `La mesa ${table} acaba de ser reservada. Elige otra.`);
  const mine = activeTables().find((t) => t.doc === person.doc || t.email === person.email);
  if (mine) return fail(res, 409, `Ya tienes la mesa ${mine.table} reservada (código ${mine.code}). Si necesitas cambiarla, escríbenos por WhatsApp.`);

  const contact = crm.byToken(person.ref) || crm.byEmail(person.email);
  const wasStage = contact && contact.stage;
  const c = crm.linkSignup(person, 'mesa', `Reservó la mesa ${table} para ${people} personas`);
  attribute(c, wasStage);

  const t = {
    id: store.id(),
    code: store.code('MESA'),
    table,
    people,
    ...person,
    notes: crm.cleanText(req.body.notes, 300),
    contactId: c.id,
    status: 'confirmada',
    checkedInAt: null,
    createdAt: new Date().toISOString(),
  };
  db().tables.push(t);
  store.save();
  sendInBackground(t, mail.tableEmail);
  res.json({ code: t.code, table: t.table, people: t.people, name: t.name, email: t.email, qr: await qrDataUrl(t.code) });
});

/* ---------- Seguimiento de enlaces y bajas ---------- */

app.get('/r/:token/:cid', (req, res) => {
  const contact = crm.byToken(req.params.token);
  const camp = db().campaigns.find((c) => c.id === req.params.cid);
  const pub = mail.mailConfig().publicUrl || `${req.protocol}://${req.get('host')}`;
  let target;
  try {
    target = new URL((camp && camp.ctaUrl) || `${pub}/after`);
  } catch {
    target = new URL(`${pub}/after`);
  }
  if (contact) {
    contact.clicked = contact.clicked || {};
    if (camp && !contact.clicked[camp.id]) {
      contact.clicked[camp.id] = new Date().toISOString();
      camp.stats.clicks++;
    }
    crm.advance(contact, 'clic', 'Abrió el enlace de la invitación');
    store.save();
    target.searchParams.set('ref', contact.token);
  }
  res.redirect(302, target.toString());
});

function simplePage(title, html) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4EBD9;font-family:Arial,sans-serif;color:#1B1530;padding:16px}
  .c{max-width:440px;background:#fff;border-radius:18px;padding:32px;text-align:center;box-shadow:0 20px 50px -20px rgba(0,0,0,.3)}
  button{padding:14px 22px;border:0;border-radius:12px;background:#E2231A;color:#fff;font-weight:bold;font-size:16px;cursor:pointer}</style></head>
  <body><div class="c">${html}</div></body></html>`;
}

app.get('/u/:token', (req, res) => {
  const contact = crm.byToken(req.params.token);
  if (!contact) return res.status(404).send(simplePage('Enlace no válido', '<h2>Enlace no válido</h2>'));
  // se pide confirmar con un botón para que los filtros que revisan enlaces no den de baja por error
  res.send(
    simplePage(
      'Darse de baja',
      contact.unsubscribed
        ? '<h2>Ya no recibirás más invitaciones</h2><p>Tu baja ya estaba registrada.</p>'
        : `<h2>¿Ya no quieres recibir invitaciones?</h2><p>Dejaremos de enviarte correos a <b>${mail.esc(contact.email)}</b>.</p>
           <form method="post"><button type="submit">Sí, darme de baja</button></form>`
    )
  );
});

app.post('/u/:token', (req, res) => {
  const contact = crm.byToken(req.params.token);
  if (contact && !contact.unsubscribed) {
    contact.unsubscribed = true;
    contact.stage = 'perdido';
    crm.activity(contact, 'baja', 'Se dio de baja de las invitaciones');
    store.save();
  }
  res.send(simplePage('Listo', '<h2>Listo, te diste de baja</h2><p>No recibirás más invitaciones. ¡Gracias!</p>'));
});

/* ================= API del panel ================= */

const sessions = new Map();
const SESSION_MS = 12 * 60 * 60 * 1000;
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();

app.post('/api/admin/login', rateLimit(10, 10 * 60 * 1000), (req, res) => {
  if (!crypto.timingSafeEqual(hash(req.body.password || ''), hash(adminPassword()))) return fail(res, 401, 'Contraseña incorrecta.');
  const tok = crypto.randomBytes(24).toString('hex');
  sessions.set(tok, Date.now() + SESSION_MS);
  // la primera vez se toma la dirección del sitio para los enlaces de los correos
  if (!mail.mailConfig().publicUrl) {
    db().settings.mail.publicUrl = `${req.protocol}://${req.get('host')}`;
    store.save();
  }
  res.json({ token: tok });
});

app.use('/api/admin', (req, res, next) => {
  const tok = (req.get('authorization') || '').replace(/^Bearer /, '');
  const exp = sessions.get(tok);
  if (!exp || exp < Date.now()) return fail(res, 401, 'Tu sesión terminó. Ingresa de nuevo.');
  next();
});

app.post('/api/admin/logout', (req, res) => {
  sessions.delete((req.get('authorization') || '').replace(/^Bearer /, ''));
  res.json({ ok: true });
});

app.get('/api/admin/summary', (req, res) => {
  const contacts = db().contacts;
  const byStage = Object.fromEntries(crm.STAGES.map((s) => [s, contacts.filter((c) => c.stage === s).length]));
  const regs = activeRegs();
  const tables = activeTables();
  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10);
    return { day: d, count: regs.filter((r) => r.createdAt.startsWith(d)).length + tables.filter((t) => t.createdAt.startsWith(d)).length };
  });
  res.json({
    event: ev(),
    people: activeRegs().length + activeTables().reduce((n, t) => n + t.people, 0),
    registrations: regs.length,
    checkedIn: regs.filter((r) => r.checkedInAt).length + tables.filter((t) => t.checkedInAt).length,
    tables: tables.length,
    tableGuests: tables.reduce((n, t) => n + t.people, 0),
    contacts: contacts.length,
    byStage,
    campaignRunning: db().campaigns.find((c) => c.status === 'enviando') || null,
    testMode: mail.isTestMode(),
    publicUrl: mail.mailConfig().publicUrl,
    last7,
  });
});

/* ---------- Inscritos y mesas ---------- */

function recordRoutes(kind, buildEmail) {
  const list = () => db()[kind];
  const find = (req) => list().find((r) => r.id === req.params.id);

  app.get(`/api/admin/${kind}`, (req, res) => res.json(list().slice().reverse()));

  app.patch(`/api/admin/${kind}/:id`, (req, res) => {
    const r = find(req);
    if (!r) return fail(res, 404, 'No encontrado.');
    const { status, checkedIn } = req.body;
    if (status && ['activa', 'confirmada', 'cancelada'].includes(status)) {
      if (kind === 'tables' && status !== 'cancelada' && activeTables().some((t) => t.id !== r.id && t.table === r.table))
        return fail(res, 409, `La mesa ${r.table} ya la tiene otra reserva.`);
      r.status = status;
    }
    if (typeof checkedIn === 'boolean') r.checkedInAt = checkedIn ? new Date().toISOString() : null;
    store.save();
    res.json(r);
  });

  app.delete(`/api/admin/${kind}/:id`, (req, res) => {
    db()[kind] = list().filter((r) => r.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  app.post(`/api/admin/${kind}/:id/resend`, (req, res) => {
    const r = find(req);
    if (!r) return fail(res, 404, 'No encontrado.');
    sendInBackground(r, buildEmail);
    res.json({ ok: true });
  });
}
recordRoutes('registrations', mail.registrationEmail);
recordRoutes('tables', mail.tableEmail);

// Control de ingreso en la puerta: por código (QR) o documento.
app.post('/api/admin/checkin', (req, res) => {
  const q = String(req.body.code || '').trim().toUpperCase();
  if (!q) return fail(res, 400, 'Escribe o escanea un código.');
  const match = (r) => r.code.toUpperCase() === q || r.doc.toUpperCase() === q;
  const reg = db().registrations.find(match);
  const table = db().tables.find(match);
  const record = reg || table;
  if (!record) return fail(res, 404, `No encontramos "${q}".`);
  const type = reg ? 'inscripción' : 'mesa';
  if (record.status === 'cancelada') return res.json({ type, record, cancelled: true });
  const already = !!record.checkedInAt;
  if (!already) {
    record.checkedInAt = new Date().toISOString();
    store.save();
  }
  res.json({ type, record, already });
});

/* ---------- CRM ---------- */

app.get('/api/admin/contacts', (req, res) => {
  const tags = [...new Set(db().contacts.flatMap((c) => c.tags))].sort();
  res.json({ stages: crm.STAGES, tags, contacts: db().contacts.map(crm.summary).reverse() });
});

app.get('/api/admin/contacts/:id', (req, res) => {
  const c = crm.byId(req.params.id);
  if (!c) return fail(res, 404, 'Contacto no encontrado.');
  const regs = db().registrations.filter((r) => r.contactId === c.id);
  const tables = db().tables.filter((t) => t.contactId === c.id);
  const sent = Object.entries(c.sent || {}).map(([cid, at]) => ({ campaign: (db().campaigns.find((x) => x.id === cid) || {}).name || 'Campaña eliminada', at }));
  res.json({ ...c, registrations: regs, tables, sentList: sent });
});

app.post('/api/admin/contacts', (req, res) => {
  const email = crm.normEmail(req.body.email);
  if (!crm.validEmail(email)) return fail(res, 400, 'Correo no válido.');
  if (crm.byEmail(email)) return fail(res, 409, 'Ya existe un contacto con ese correo.');
  const c = crm.create({ ...req.body, email, tags: (req.body.tags || []).map((t) => crm.cleanText(t, 40)), source: 'manual' });
  crm.activity(c, 'creado', 'Creado manualmente');
  store.save();
  res.json(crm.summary(c));
});

app.patch('/api/admin/contacts/:id', (req, res) => {
  const c = crm.byId(req.params.id);
  if (!c) return fail(res, 404, 'Contacto no encontrado.');
  const b = req.body;
  if (b.name !== undefined) c.name = crm.cleanText(b.name);
  if (b.phone !== undefined) c.phone = crm.cleanPhone(b.phone);
  if (b.city !== undefined) c.city = crm.cleanText(b.city, 60);
  if (Array.isArray(b.tags)) c.tags = [...new Set(b.tags.map((t) => crm.cleanText(t, 40)).filter(Boolean))];
  if (b.notes !== undefined && b.notes !== c.notes) {
    c.notes = String(b.notes).slice(0, 2000);
    crm.activity(c, 'nota', 'Actualizó las notas');
  }
  if (b.stage) crm.setStage(c, b.stage);
  if (typeof b.unsubscribed === 'boolean') c.unsubscribed = b.unsubscribed;
  c.updatedAt = new Date().toISOString();
  store.save();
  res.json(crm.summary(c));
});

app.delete('/api/admin/contacts/:id', (req, res) => {
  db().contacts = db().contacts.filter((c) => c.id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

app.post('/api/admin/contacts/bulk', (req, res) => {
  const ids = new Set(req.body.ids || []);
  const { action, value } = req.body;
  const list = db().contacts.filter((c) => ids.has(c.id));
  if (action === 'delete') db().contacts = db().contacts.filter((c) => !ids.has(c.id));
  if (action === 'stage') list.forEach((c) => crm.setStage(c, value));
  if (action === 'tag' && value) list.forEach((c) => c.tags.includes(value) || c.tags.push(crm.cleanText(value, 40)));
  store.save();
  res.json({ ok: true, count: list.length });
});

app.post('/api/admin/contacts/import', (req, res) => {
  if (req.body.consent !== true) return fail(res, 400, 'Confirma que los contactos autorizaron recibir comunicaciones (Ley 1581 de 2012).');
  const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 50000) : [];
  if (!rows.length) return fail(res, 400, 'El archivo no tiene filas.');
  const result = crm.importRows(rows, crm.cleanText(req.body.tag, 40));
  store.save();
  res.json(result);
});

/* ---------- Campañas ---------- */

const DEFAULT_CAMPAIGN = () => ({
  name: 'Invitación ¿Dónde es el After?',
  tag: '',
  subjects: [
    '{{nombre}}, ¿te apuntas al After del 24?',
    '{{nombre}}, esta fiesta te va a traer recuerdos',
    'Te guardamos un lugar, {{nombre}}',
    'Una noche colombo-venezolana en Cúcuta',
  ].join('\n'),
  preheaders: ['Billo’s, Los Melódicos, Natusha y mucho más', 'Sábado 24 de octubre · Patín de la Fruta', 'Como en las fiestas familiares de la frontera'].join('\n'),
  body: `{Hola|Qué más|Epa} {{nombre}} 👋

El sábado 24 de octubre armamos una fiesta {para recordar|de esas que no se olvidan}: Billo's, Los Melódicos, Natusha, Caramelos de Cianuro y {mucho más|muchos más}, como en las fiestas familiares de la frontera.

La entrada no tiene costo. Solo {te pedimos inscribirte|necesitas inscribirte} por seguridad y control de ingreso.`,
  ctaText: '{Quiero inscribirme|Reservar mi lugar|Inscribirme ahora}',
  ctaUrl: '',
  signature: '{Un abrazo|Nos vemos allá},\nEquipo Mangos Espaciales',
  fallbackName: 'pana',
  includePoster: true,
  interval: 15,
  dailyLimit: 200,
});

const EDITABLE = ['name', 'tag', 'subjects', 'preheaders', 'body', 'ctaText', 'ctaUrl', 'signature', 'fallbackName', 'includePoster', 'interval', 'dailyLimit'];
function applyCampaign(target, body) {
  for (const k of EDITABLE) if (body[k] !== undefined) target[k] = body[k];
  target.interval = Math.max(campaigns.MIN_INTERVAL, Number(target.interval) || campaigns.MIN_INTERVAL);
  target.dailyLimit = Math.max(1, Math.min(5000, Number(target.dailyLimit) || 200));
  target.includePoster = !!target.includePoster;
}

const campaignView = (c) => ({ ...c, pending: campaigns.pending(c).length, log: (c.log || []).slice(0, 30) });

app.get('/api/admin/campaigns', (req, res) => res.json(db().campaigns.slice().reverse().map(campaignView)));

app.post('/api/admin/campaigns', (req, res) => {
  const pub = mail.mailConfig().publicUrl;
  const c = { id: store.id(), ...DEFAULT_CAMPAIGN(), ctaUrl: pub ? `${pub}/after#registro` : '', status: 'borrador', stats: { sent: 0, failed: 0, clicks: 0, registered: 0 }, log: [], createdAt: new Date().toISOString() };
  applyCampaign(c, req.body || {});
  db().campaigns.push(c);
  store.save();
  res.json(campaignView(c));
});

const findCampaign = (req) => db().campaigns.find((c) => c.id === req.params.id);

app.put('/api/admin/campaigns/:id', (req, res) => {
  const c = findCampaign(req);
  if (!c) return fail(res, 404, 'Campaña no encontrada.');
  if (c.status === 'enviando') return fail(res, 409, 'Pausa la campaña antes de editarla.');
  applyCampaign(c, req.body);
  store.save();
  res.json(campaignView(c));
});

app.delete('/api/admin/campaigns/:id', (req, res) => {
  const c = findCampaign(req);
  if (c && c.status === 'enviando') return fail(res, 409, 'Pausa la campaña antes de eliminarla.');
  db().campaigns = db().campaigns.filter((x) => x.id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

app.post('/api/admin/campaigns/:id/start', (req, res) => {
  const c = findCampaign(req);
  if (!c) return fail(res, 404, 'Campaña no encontrada.');
  try {
    campaigns.start(c);
    res.json(campaignView(c));
  } catch (err) {
    fail(res, 409, err.message);
  }
});

app.post('/api/admin/campaigns/:id/pause', (req, res) => {
  const c = findCampaign(req);
  if (!c) return fail(res, 404, 'Campaña no encontrada.');
  campaigns.pause(c);
  res.json(campaignView(c));
});

// Vista previa con un contacto de ejemplo (o el borrador sin guardar).
app.post('/api/admin/campaigns/preview', (req, res) => {
  const draft = { id: 'preview', ...DEFAULT_CAMPAIGN() };
  applyCampaign(draft, req.body || {});
  const sample = { name: req.body.sampleName || 'María Fernanda', email: 'ejemplo@correo.com', token: 'vista-previa' };
  const email = mail.invitationEmail(draft, sample, ev());
  res.json({ subject: email.subject, html: email.html, text: email.text });
});

app.post('/api/admin/campaigns/:id/test', async (req, res) => {
  const c = findCampaign(req);
  const to = crm.normEmail(req.body.to);
  if (!c) return fail(res, 404, 'Campaña no encontrada.');
  if (!crm.validEmail(to)) return fail(res, 400, 'Escribe un correo válido para la prueba.');
  try {
    const email = mail.invitationEmail(c, { name: req.body.name || 'Prueba', email: to, token: 'prueba' }, ev());
    const info = await mail.send({ ...email, subject: `[Prueba] ${email.subject}` });
    res.json({ ok: true, testMode: info.testMode });
  } catch (err) {
    fail(res, 500, `No se pudo enviar: ${err.message}`);
  }
});

/* ---------- Ajustes ---------- */

const MASK = '••••••••';
app.get('/api/admin/settings', (req, res) => {
  const s = db().settings;
  const env = process.env;
  res.json({
    event: s.event,
    mail: { ...s.mail, smtpPass: s.mail.smtpPass ? MASK : '' },
    fromEnv: {
      smtp: !!env.SMTP_HOST,
      publicUrl: !!env.PUBLIC_URL,
      adminPassword: !!env.ADMIN_PASSWORD,
    },
    testMode: mail.isTestMode(),
    effective: { publicUrl: mail.mailConfig().publicUrl, fromEmail: mail.mailConfig().fromEmail },
  });
});

app.put('/api/admin/settings', (req, res) => {
  const s = db().settings;
  const { event, mail: m, adminPassword: pw } = req.body;
  if (event) {
    const e = { ...s.event, ...event };
    delete e.capacity;
    e.tableCount = Math.max(0, Math.min(200, Number(e.tableCount) || 0));
    e.tableSeats = Math.max(1, Math.min(30, Number(e.tableSeats) || 1));
    e.lineup = (e.lineup || []).filter((a) => a && a.name).map((a) => ({ name: crm.cleanText(a.name, 60), country: ['VE', 'CO', 'CO-VE'].includes(a.country) ? a.country : 'VE', genre: crm.cleanText(a.genre, 40) }));
    s.event = e;
  }
  if (m) {
    const next = { ...s.mail, ...m };
    if (m.smtpPass === MASK) next.smtpPass = s.mail.smtpPass;
    next.smtpPort = Number(next.smtpPort) || 587;
    next.smtpSecure = !!next.smtpSecure;
    next.publicUrl = String(next.publicUrl || '').trim().replace(/\/+$/, '');
    s.mail = next;
  }
  if (pw) {
    if (process.env.ADMIN_PASSWORD) return fail(res, 409, 'La contraseña está definida en el servidor (ADMIN_PASSWORD).');
    if (String(pw).length < 8) return fail(res, 400, 'La contraseña debe tener mínimo 8 caracteres.');
    s.adminPassword = String(pw);
  }
  store.save();
  res.json({ ok: true });
});

app.post('/api/admin/mail/test', async (req, res) => {
  const to = crm.normEmail(req.body.to);
  if (!crm.validEmail(to)) return fail(res, 400, 'Escribe un correo válido.');
  try {
    await mail.verify();
    const info = await mail.send({
      to,
      subject: 'Prueba de correo · Mangos Espaciales',
      text: 'Si lees esto, el correo quedó bien configurado. ¡Listo para enviar!',
      html: '<p style="font-family:Arial,sans-serif">Si lees esto, el correo quedó bien configurado. <b>¡Listo para enviar!</b></p>',
      kind: 'prueba',
    });
    res.json({ ok: true, testMode: info.testMode });
  } catch (err) {
    fail(res, 500, `No se pudo conectar con el servidor de correo: ${err.message}`);
  }
});

app.get('/api/admin/outbox', (req, res) => res.json(mail.listOutbox()));
app.get('/api/admin/outbox/:id', (req, res) => {
  const m = mail.readOutbox(req.params.id);
  return m ? res.json(m) : fail(res, 404, 'No encontrado.');
});

/* ---------- Patrocinadores ---------- */

const SPONSOR_BG = ['glass', 'white', 'dark', 'none'];
const SPONSOR_SPEED = ['lento', 'normal', 'rapido'];
const clampInt = (v, min, max, def) => (v === '' || v === null || v === undefined || !isFinite(Number(v)) ? def : Math.max(min, Math.min(max, Math.round(Number(v)))));
const sponsorUrl = (u) => {
  u = String(u || '').trim();
  return /^https?:\/\/\S+$/i.test(u) || /^\/uploads\/[\w.-]+$/.test(u) ? u.slice(0, 500) : '';
};

app.get('/api/admin/sponsors', (req, res) => {
  const s = db().settings;
  res.json({ sponsors: s.sponsors || [], sponsorConfig: s.sponsorConfig });
});

app.put('/api/admin/sponsors', (req, res) => {
  const list = Array.isArray(req.body.sponsors) ? req.body.sponsors.slice(0, 80) : null;
  if (!list) return fail(res, 400, 'Lista inválida.');
  const s = db().settings;
  s.sponsors = list
    .map((p) => ({
      id: String(p.id || store.id()).replace(/[^\w-]/g, '').slice(0, 20),
      name: crm.cleanText(p.name, 60),
      logo: sponsorUrl(p.logo),
      link: sponsorUrl(p.link).startsWith('/') ? '' : sponsorUrl(p.link),
      height: clampInt(p.height, 16, 120, null),
      border: clampInt(p.border, 0, 10, 0),
      bg: SPONSOR_BG.includes(p.bg) ? p.bg : 'glass',
      featured: !!p.featured,
      active: p.active !== false,
    }))
    .filter((p) => p.logo);
  const c = req.body.sponsorConfig || {};
  s.sponsorConfig = { height: clampInt(c.height, 16, 120, 40), speed: SPONSOR_SPEED.includes(c.speed) ? c.speed : 'lento' };
  store.save();
  res.json({ sponsors: s.sponsors, sponsorConfig: s.sponsorConfig });
});

// Los logos llegan ya procesados como PNG/JPG/WEBP (nunca SVG) y se guardan en data/uploads.
const UPLOADS = path.join(store.DATA_DIR, 'uploads');
app.post('/api/admin/uploads', (req, res) => {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.dataUrl || ''));
  if (!m) return fail(res, 400, 'Formato de imagen no válido.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3 * 1024 * 1024) return fail(res, 400, 'El logo pesa más de 3 MB.');
  require('fs').mkdirSync(UPLOADS, { recursive: true });
  const name = `${store.token()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  require('fs').writeFileSync(path.join(UPLOADS, name), buf);
  res.json({ url: `/uploads/${name}` });
});

app.use('/api', (req, res) => fail(res, 404, 'Ruta no encontrada.'));

/* ================= Sitio ================= */

// Nunca se publican el código del servidor, los datos ni la configuración.
app.use((req, res, next) => {
  if (/^\/(server|data|node_modules)(\/|$)/i.test(req.path) || /^\/(package(-lock)?\.json|\.env.*|\.git.*)$/i.test(req.path)) return res.status(404).end();
  next();
});
// la landing del evento es la página principal; /after se mantiene para enlaces ya compartidos
app.get('/after', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.use('/uploads', express.static(UPLOADS, { dotfiles: 'deny', maxAge: '7d' }));
app.get('/crm', (req, res) => res.sendFile(path.join(ROOT, 'crm.html')));
app.use(express.static(ROOT, { dotfiles: 'ignore', extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`\n🥭 Mangos Espaciales en http://localhost:${PORT}`);
  console.log(`   Landing del evento: http://localhost:${PORT}/after`);
  console.log(`   Panel / CRM:        http://localhost:${PORT}/crm`);
  if (!process.env.ADMIN_PASSWORD) console.log(`   Contraseña del panel: ${adminPassword()}  (defínela con ADMIN_PASSWORD)`);
  console.log(mail.isTestMode() ? '   Correo: MODO PRUEBA (configura SMTP para enviar de verdad)\n' : '   Correo: SMTP configurado\n');
  campaigns.resume();
});
