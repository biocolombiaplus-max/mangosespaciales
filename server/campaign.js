/*
 * Envío pausado de campañas: un correo cada N segundos (mínimo 10) con una
 * pequeña variación aleatoria, límite diario y parada automática ante errores.
 * Antes de cada envío se vuelve a revisar quién sigue pendiente, así quien se
 * inscribe a mitad de campaña ya no recibe el correo.
 */
const store = require('./store');
const mail = require('./mail');
const crm = require('./crm');

const MIN_INTERVAL = 10;
const MAX_CONSECUTIVE_ERRORS = 5;
const SKIP_STAGES = new Set(['registrado', 'mesa', 'perdido']);

let timer = null;
let busy = false;

const running = () => store.get().campaigns.find((c) => c.status === 'enviando');

function eligible(campaign, contact) {
  return (
    !contact.unsubscribed &&
    !contact.bounced &&
    !SKIP_STAGES.has(contact.stage) &&
    !(contact.sent || {})[campaign.id] &&
    crm.validEmail(contact.email) &&
    (!campaign.tag || contact.tags.includes(campaign.tag))
  );
}

const pending = (campaign) => store.get().contacts.filter((c) => eligible(campaign, c));

function sentToday() {
  const today = new Date().toISOString().slice(0, 10);
  const log = store.get().sendLog;
  // se guarda solo lo de hoy
  store.get().sendLog = log.filter((d) => d.startsWith(today));
  return store.get().sendLog.length;
}

function log(campaign, entry) {
  campaign.log = campaign.log || [];
  campaign.log.unshift({ at: new Date().toISOString(), ...entry });
  campaign.log.length = Math.min(campaign.log.length, 80);
}

function schedule(seconds) {
  clearTimeout(timer);
  timer = setTimeout(tick, seconds * 1000);
}

function nextDelay(campaign) {
  const base = Math.max(MIN_INTERVAL, Number(campaign.interval) || MIN_INTERVAL);
  return base + Math.random() * Math.min(8, base * 0.5); // variación para no ser un robot exacto
}

// El rebote definitivo (buzón inexistente) se marca para no volver a intentarlo.
const isHardBounce = (err) => err && (err.responseCode >= 550 && err.responseCode <= 553);

async function tick() {
  if (busy) return;
  const campaign = running();
  if (!campaign) return;
  busy = true;
  try {
    const limit = Number(campaign.dailyLimit) || 200;
    if (sentToday() >= limit) {
      campaign.note = `Límite diario de ${limit} correos alcanzado. Continúa automáticamente mañana.`;
      store.save();
      return schedule(600);
    }
    const contact = pending(campaign)[0];
    if (!contact) {
      campaign.status = 'terminada';
      campaign.finishedAt = new Date().toISOString();
      campaign.note = 'Se envió a todos los contactos pendientes.';
      store.save();
      return;
    }

    const ev = store.get().settings.event;
    const email = mail.invitationEmail(campaign, contact, ev);
    try {
      await mail.send(email);
      contact.sent = { ...(contact.sent || {}), [campaign.id]: new Date().toISOString() };
      crm.advance(contact, 'invitado', `Invitación enviada: "${email.subject}"`);
      campaign.stats.sent++;
      campaign.errorsInRow = 0;
      campaign.note = '';
      store.get().sendLog.push(new Date().toISOString());
      log(campaign, { ok: true, email: contact.email, subject: email.subject });
    } catch (err) {
      campaign.stats.failed++;
      campaign.errorsInRow = (campaign.errorsInRow || 0) + 1;
      log(campaign, { ok: false, email: contact.email, error: String(err.message || err).slice(0, 200) });
      // se marca como intentado para no quedar atascados en el mismo contacto
      contact.sent = { ...(contact.sent || {}), [campaign.id]: 'error' };
      if (isHardBounce(err)) {
        contact.bounced = true;
        contact.stage = 'perdido';
        crm.activity(contact, 'rebote', `El correo rebotó: ${String(err.message).slice(0, 120)}`);
      }
      if (campaign.errorsInRow >= MAX_CONSECUTIVE_ERRORS) {
        campaign.status = 'pausada';
        campaign.note = `Pausada automáticamente por ${MAX_CONSECUTIVE_ERRORS} errores seguidos. Revisa la configuración del correo.`;
        store.save();
        return;
      }
    }
    store.save();
    schedule(nextDelay(campaign));
  } finally {
    busy = false;
  }
}

function start(campaign) {
  const other = running();
  if (other && other.id !== campaign.id) throw new Error(`Ya se está enviando la campaña "${other.name}". Páusala primero.`);
  if (!mail.mailConfig().publicUrl) throw new Error('Configura la URL pública del sitio en Ajustes antes de enviar (se usa para los botones y la baja).');
  campaign.status = 'enviando';
  campaign.startedAt = campaign.startedAt || new Date().toISOString();
  campaign.note = '';
  campaign.errorsInRow = 0;
  store.save();
  schedule(1);
}

function pause(campaign) {
  if (campaign.status === 'enviando') {
    campaign.status = 'pausada';
    campaign.note = 'Pausada manualmente.';
    clearTimeout(timer);
    store.save();
  }
}

// Al reiniciar el servidor se retoma la campaña que estaba enviándose.
function resume() {
  if (running()) schedule(5);
}

module.exports = { start, pause, resume, pending, eligible, MIN_INTERVAL };
