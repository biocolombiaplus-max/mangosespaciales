/* Contactos del CRM: etapas del embudo, actividad e importación. */
const store = require('./store');

// Orden del embudo. "perdido" agrupa bajas y correos que rebotaron.
const STAGES = ['nuevo', 'invitado', 'clic', 'registrado', 'mesa', 'perdido'];
const RANK = { nuevo: 0, invitado: 1, clic: 2, registrado: 3, mesa: 4 };

const normEmail = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e);
const cleanPhone = (p) => String(p || '').replace(/[^\d+]/g, '').slice(0, 20);
const cleanText = (s, max = 120) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

const MAX_TIMELINE = 60;
function activity(contact, type, text) {
  contact.timeline = contact.timeline || [];
  contact.timeline.unshift({ at: new Date().toISOString(), type, text });
  contact.timeline.length = Math.min(contact.timeline.length, MAX_TIMELINE);
  contact.updatedAt = new Date().toISOString();
}

const byEmail = (email) => store.get().contacts.find((c) => c.email === normEmail(email));
const byToken = (token) => store.get().contacts.find((c) => c.token === token);
const byId = (id) => store.get().contacts.find((c) => c.id === id);

function create({ name, email, phone, city, tags, source }) {
  const now = new Date().toISOString();
  const c = {
    id: store.id(),
    token: store.token(),
    name: cleanText(name),
    email: normEmail(email),
    phone: cleanPhone(phone),
    city: cleanText(city, 60),
    tags: [...new Set((tags || []).filter(Boolean))],
    stage: 'nuevo',
    source: source || 'manual',
    unsubscribed: false,
    bounced: false,
    notes: '',
    sent: {}, // campaignId -> fecha de envío
    timeline: [],
    createdAt: now,
    updatedAt: now,
  };
  store.get().contacts.push(c);
  return c;
}

// Avanza en el embudo sin retroceder (los cambios manuales usan setStage).
function advance(contact, stage, text) {
  const cur = contact.stage;
  const forward = cur === 'perdido' ? RANK[stage] >= RANK.registrado : RANK[stage] > (RANK[cur] ?? -1);
  if (forward) contact.stage = stage;
  if (text) activity(contact, stage, text);
}

function setStage(contact, stage) {
  if (!STAGES.includes(stage) || contact.stage === stage) return;
  activity(contact, 'etapa', `Movido manualmente a "${stage}"`);
  contact.stage = stage;
}

/* Une una inscripción o mesa con su contacto: por el enlace del correo
   (ref) o por el correo electrónico. Si no existe, lo crea. */
function linkSignup({ ref, name, email, phone, city }, kind, text) {
  let c = (ref && byToken(ref)) || byEmail(email);
  if (!c) c = create({ name, email, phone, city, tags: ['Landing'], source: 'landing' });
  if (!c.name && name) c.name = cleanText(name);
  if (!c.phone && phone) c.phone = cleanPhone(phone);
  advance(c, kind, text);
  return c;
}

/* Importa filas [{name,email,phone,city}] deduplicando por correo. */
function importRows(rows, tag) {
  const result = { added: 0, updated: 0, invalid: 0, duplicated: 0 };
  const seen = new Set();
  for (const r of rows) {
    const email = normEmail(r.email);
    if (!validEmail(email)) {
      result.invalid++;
      continue;
    }
    if (seen.has(email)) {
      result.duplicated++;
      continue;
    }
    seen.add(email);
    const existing = byEmail(email);
    if (existing) {
      if (tag && !existing.tags.includes(tag)) existing.tags.push(tag);
      if (!existing.name && r.name) existing.name = cleanText(r.name);
      if (!existing.phone && r.phone) existing.phone = cleanPhone(r.phone);
      if (!existing.city && r.city) existing.city = cleanText(r.city, 60);
      existing.updatedAt = new Date().toISOString();
      result.updated++;
    } else {
      const c = create({ ...r, tags: tag ? [tag] : [], source: 'importado' });
      activity(c, 'importado', `Importado${tag ? ` en "${tag}"` : ''}`);
      result.added++;
    }
  }
  return result;
}

// Vista liviana para el tablero (sin historial).
const summary = (c) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  phone: c.phone,
  city: c.city,
  tags: c.tags,
  stage: c.stage,
  source: c.source,
  unsubscribed: c.unsubscribed,
  bounced: c.bounced,
  updatedAt: c.updatedAt,
});

module.exports = { STAGES, normEmail, validEmail, cleanPhone, cleanText, activity, byEmail, byToken, byId, create, advance, setStage, linkSignup, importRows, summary };
