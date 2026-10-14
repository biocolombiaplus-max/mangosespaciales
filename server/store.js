/*
 * Almacenamiento en un archivo JSON (data/db.json).
 * Suficiente para miles de contactos e inscripciones. Cada cambio se escribe
 * en un archivo temporal y luego se renombra, para no dejar el archivo a medias.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_EVENT = {
  title: '¿Dónde es el After?',
  edition: 'Vol. 1',
  city: 'Cúcuta',
  tagline: 'De Venezuela para el mundo',
  subtitle: 'La fiesta colombo-venezolana para recordar y gozar como en las mejores fiestas de los 80, 90 y 2000.',
  date: '2026-10-24T18:00',
  venue: 'Patín de la Fruta',
  venueDetail: 'Malecón',
  address: 'Malecón, Cúcuta, Norte de Santander',
  whatsapp: '573005081812',
  instagram: '',
  organizer: 'Mangos Espaciales',
  registrationOpen: true,
  tablesOpen: true,
  tableCount: 30,
  tableSeats: 6,
  tableConditions: 'Reserva sin costo. Te escribimos por WhatsApp para confirmar los detalles de tu mesa.',
  lineup: [
    { name: "Billo's Caracas Boys", country: 'VE', genre: 'Orquesta bailable' },
    { name: 'Los Melódicos', country: 'VE', genre: 'Orquesta bailable' },
    { name: 'Natusha', country: 'VE', genre: 'Tecnomerengue' },
    { name: 'Miguel Moly', country: 'VE', genre: 'Merengue' },
    { name: 'Caramelos de Cianuro', country: 'VE', genre: 'Rock' },
    { name: 'Los Amigos Invisibles', country: 'VE', genre: 'Funk · Acid jazz' },
    { name: 'Danny Ocean', country: 'VE', genre: 'Pop urbano' },
  ],
};

const DEFAULT_MAIL = {
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  fromName: 'Mangos Espaciales',
  fromEmail: '',
  replyTo: '',
  publicUrl: '',
  physicalAddress: 'Cúcuta, Norte de Santander, Colombia',
};

const DEFAULT_DB = () => ({
  settings: { event: { ...DEFAULT_EVENT, lineup: DEFAULT_EVENT.lineup.map((a) => ({ ...a })) }, mail: { ...DEFAULT_MAIL }, adminPassword: '', sponsors: [], sponsorConfig: { height: 40, speed: 'lento' } },
  registrations: [],
  tables: [],
  contacts: [],
  campaigns: [],
  sendLog: [], // fechas de envío de campañas, para el límite diario
});

let db = null;

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(FILE)) {
    const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const base = DEFAULT_DB();
    db = {
      ...base,
      ...saved,
      settings: {
        ...base.settings,
        ...saved.settings,
        event: { ...base.settings.event, ...(saved.settings || {}).event },
        mail: { ...base.settings.mail, ...(saved.settings || {}).mail },
      },
    };
  } else {
    db = DEFAULT_DB();
    save();
  }
  return db;
}

function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}

const get = () => db || load();

const id = () => crypto.randomBytes(8).toString('hex');
// Códigos fáciles de dictar: sin 0/O ni 1/I
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code(prefix) {
  const bytes = crypto.randomBytes(6);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${s}`;
}
const token = () => crypto.randomBytes(9).toString('base64url');

module.exports = { load, save, get, id, code, token, DATA_DIR, DEFAULT_EVENT };
