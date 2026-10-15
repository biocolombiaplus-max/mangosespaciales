/* Utilidades compartidas de las funciones de Vercel: Cloudinary, sesión del panel y respuestas.
   Los archivos que empiezan por "_" no se publican como rutas. Sin dependencias: solo Node 20+. */
const crypto = require('crypto');

const ROOT = 'after'; // carpeta del evento en Cloudinary
const SPONSORS_ID = `${ROOT}/config/patrocinadores.json`;
const REGS_PREFIX = `${ROOT}/inscritos/`;
const LOGOS_FOLDER = `${ROOT}/logos`;

// Acepta CLOUDINARY_URL (cloudinary://API_KEY:API_SECRET@CLOUD_NAME) o las tres variables sueltas.
function creds() {
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@([\w-]+)\s*$/.exec((process.env.CLOUDINARY_URL || '').trim().replace(/^CLOUDINARY_URL=/, ''));
  if (m) return { key: m[1], secret: m[2], cloud: m[3] };
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  return cloud && key && secret ? { cloud: cloud.trim(), key: key.trim(), secret: secret.trim() } : null;
}

const apiBase = () => `${process.env.CLOUDINARY_API_BASE || 'https://api.cloudinary.com'}/v1_1/`;
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const NOT_CONFIGURED = 'El almacenamiento aún no está conectado: falta la variable CLOUDINARY_URL en Vercel.';

function need() {
  const c = creds();
  if (!c) throw new HttpError(503, NOT_CONFIGURED);
  return c;
}

// Firma de Cloudinary: parámetros ordenados "a=1&b=2" + API secret, en SHA-1.
function signParams(params, secret) {
  const base = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return sha1(base + secret);
}

// Contexto de Cloudinary: "clave=valor|clave2=valor2"; "=" y "|" se escapan.
const ctxValue = (v) => String(v ?? '').replace(/[|=]/g, (c) => '\\' + c).slice(0, 200);
const contextString = (obj) => Object.entries(obj).map(([k, v]) => `${k}=${ctxValue(v)}`).join('|');

async function cloudFetch(url, opts) {
  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new HttpError(502, 'No se pudo conectar con Cloudinary. Inténtalo de nuevo.');
  }
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// Sube un JSON como archivo "raw" (firmado desde el servidor).
async function uploadJson(publicId, obj, extra = {}) {
  const c = need();
  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000), ...extra };
  const body = new URLSearchParams({
    ...params,
    file: 'data:application/json;base64,' + Buffer.from(JSON.stringify(obj)).toString('base64'),
    api_key: c.key,
    signature: signParams(params, c.secret),
  });
  const { res, data } = await cloudFetch(`${apiBase()}${c.cloud}/raw/upload`, { method: 'POST', body });
  if (!res.ok) throw new HttpError(502, cloudError(data, res.status));
  return data;
}

// API de administración (lectura). Devuelve null si el recurso no existe.
async function adminGet(path) {
  const c = need();
  const { res, data } = await cloudFetch(`${apiBase()}${c.cloud}/${path}`, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${c.key}:${c.secret}`).toString('base64') },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, cloudError(data, res.status));
  return data;
}

function cloudError(data, status) {
  const msg = (data && data.error && data.error.message) || '';
  if (status === 401 || /api_key|signature|credentials/i.test(msg)) return 'Cloudinary rechazó las credenciales: revisa CLOUDINARY_URL en Vercel.';
  if (status === 420 || status === 429) return 'Cloudinary está limitando las solicitudes. Espera un momento e inténtalo de nuevo.';
  return 'Cloudinary respondió con un error' + (msg ? `: ${msg}` : '.');
}

async function getJson(url) {
  const { res, data } = await cloudFetch(url, { cache: 'no-store' });
  if (!res.ok) throw new HttpError(502, 'No se pudo leer el archivo en Cloudinary.');
  return data;
}

/* ---------- Patrocinadores ---------- */
const SPONSOR_BG = ['glass', 'white', 'dark', 'none'];
const SPONSOR_SPEED = ['lento', 'normal', 'rapido'];
const BIOMARKETING_WA = 'https://wa.me/573505457420?text=%C2%A1Hola%2C%20Biomarketing%21%20%F0%9F%91%8B%20Vi%20su%20trabajo%20en%20la%20p%C3%A1gina%20del%20evento%20%2A%C2%BFD%C3%B3nde%20es%20el%20After%3F%20Vol.%201%2A%20de%20Mangos%20Espaciales%20y%20me%20gustar%C3%ADa%20recibir%20informaci%C3%B3n%20sobre%20sus%20servicios%20de%20dise%C3%B1o%20web%20y%20marketing%20digital.%20%C2%A1Gracias%21';
const DEFAULT_SPONSORS = { sponsors: [], sponsorConfig: { height: 40, speed: 'lento', creditWeb: BIOMARKETING_WA, creditWebLogo: '', creditTickets: 'https://eventosid.com', creditTicketsLogo: '' } };

// Una copia en memoria evita leer Cloudinary en cada visita mientras la función siga activa.
let sponsorsCache = null;
async function readSponsors({ fresh } = {}) {
  if (!fresh && sponsorsCache && Date.now() - sponsorsCache.at < 15000) return sponsorsCache.data;
  const meta = await adminGet(`resources/raw/upload/${SPONSORS_ID}`);
  const file = meta ? await getJson(meta.secure_url) : {};
  const data = { ...DEFAULT_SPONSORS, ...file, sponsorConfig: { ...DEFAULT_SPONSORS.sponsorConfig, ...(file.sponsorConfig || {}) } };
  sponsorsCache = { at: Date.now(), data };
  return data;
}

const clampInt = (v, min, max, def) => (v === '' || v === null || v === undefined || !isFinite(Number(v)) ? def : Math.max(min, Math.min(max, Math.round(Number(v)))));
const httpsUrl = (u) => {
  u = String(u || '').trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u.slice(0, 500) : '';
};
const linkUrl = (u, max = 500) => {
  u = String(u || '').trim();
  if (u && !/^[a-z]+:/i.test(u)) u = 'https://' + u; // "instagram.com/marca" también sirve
  return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u.slice(0, max) : '';
};
const cleanText = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function cleanSponsors(body) {
  const list = Array.isArray(body.sponsors) ? body.sponsors.slice(0, 80) : null;
  if (!list) throw new HttpError(400, 'Lista de patrocinadores inválida.');
  const c = body.sponsorConfig || {};
  return {
    sponsors: list
      .map((p, i) => ({
        id: String(p.id || `sp${Date.now().toString(36)}${i}`).replace(/[^\w-]/g, '').slice(0, 24),
        name: cleanText(p.name, 60),
        logo: httpsUrl(p.logo),
        link: linkUrl(p.link),
        height: clampInt(p.height, 16, 120, null),
        border: clampInt(p.border, 0, 10, 0),
        bg: SPONSOR_BG.includes(p.bg) ? p.bg : 'glass',
        featured: !!p.featured,
        active: p.active !== false,
      }))
      .filter((p) => p.logo),
    // creditWeb / creditTickets: enlaces de los créditos del pie de página
    sponsorConfig: { height: clampInt(c.height, 16, 120, 40), speed: SPONSOR_SPEED.includes(c.speed) ? c.speed : 'lento', creditWeb: linkUrl(c.creditWeb, 1500), creditWebLogo: httpsUrl(c.creditWebLogo), creditTickets: linkUrl(c.creditTickets, 1500), creditTicketsLogo: httpsUrl(c.creditTicketsLogo) },
  };
}

async function saveSponsors(body) {
  const data = cleanSponsors(body);
  await uploadJson(SPONSORS_ID, { ...data, updatedAt: new Date().toISOString() }, { overwrite: 'true', invalidate: 'true' });
  sponsorsCache = { at: Date.now(), data };
  return data;
}

/* ---------- Sesión del panel ----------
   Token sin estado: vencimiento + firma HMAC con la clave del panel y el secreto de Cloudinary.
   Si cambias ADMIN_PASSWORD, todas las sesiones abiertas se cierran. */
const SESSION_MS = 12 * 60 * 60 * 1000;
const adminPassword = () => process.env.ADMIN_PASSWORD || '123456';
const tokenKey = () => `${adminPassword()}::${(creds() || {}).secret || ''}`;
const hmac = (s) => crypto.createHmac('sha256', tokenKey()).update(s).digest('hex');
const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

function makeToken() {
  const exp = String(Date.now() + SESSION_MS);
  return `${exp}.${hmac(exp)}`;
}
function requireAdmin(req) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const [exp, sig] = tok.split('.');
  if (!exp || !sig || Number(exp) < Date.now() || !same(sig, hmac(exp))) throw new HttpError(401, 'Tu sesión terminó. Ingresa de nuevo.');
}

/* ---------- HTTP ---------- */
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1e6) throw new HttpError(413, 'Solicitud demasiado grande.');
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch (e) {
    throw new HttpError(400, 'Solicitud inválida.');
  }
}

function send(res, status, data, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(data));
}

// Envuelve cada función: métodos permitidos y errores en JSON.
function handler(methods) {
  return async (req, res) => {
    const fn = methods[req.method];
    if (!fn) {
      res.setHeader('Allow', Object.keys(methods).join(', '));
      return send(res, 405, { error: 'Método no permitido.' });
    }
    try {
      await fn(req, res);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500 && status !== 503) console.error('[api]', req.url, e.message);
      send(res, status, { error: e instanceof HttpError ? e.message : 'Error inesperado. Inténtalo de nuevo.', ...(status === 503 ? { code: 'not_configured' } : {}) });
    }
  };
}

module.exports = {
  ROOT, REGS_PREFIX, LOGOS_FOLDER, HttpError, creds, need, apiBase, signParams, contextString, uploadJson, adminGet, getJson,
  readSponsors, saveSponsors, cleanText, adminPassword, same, makeToken, requireAdmin, readBody, send, handler,
};
