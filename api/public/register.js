// POST /api/public/register · inscripción gratis. Cada documento es un archivo en Cloudinary
// (after/inscritos/<documento>.json): si ya existe, Cloudinary no lo sobrescribe.
const crypto = require('crypto');
const { REGS_PREFIX, HttpError, uploadJson, getJson, contextString, cleanText, readBody, send, handler } = require('../_lib/cloud');

const DOC_TYPES = ['CC', 'CE', 'PPT', 'Pasaporte', 'Cédula venezolana'];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => 'AFT-' + [...crypto.randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('');

function readPerson(b) {
  if (b.website) throw new HttpError(400, 'Solicitud inválida.'); // campo trampa para robots
  if (!DOC_TYPES.includes(b.docType)) throw new HttpError(400, 'Tipo de documento no válido.');
  const p = {
    name: cleanText(b.name, 80),
    docType: b.docType,
    doc: String(b.doc || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 15),
    phone: String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20),
    email: String(b.email || '').trim().toLowerCase().slice(0, 120),
    barrio: cleanText(b.barrio, 60),
    city: cleanText(b.city, 60),
    ref: String(b.ref || '').replace(/[^\w-]/g, '').slice(0, 20),
  };
  if (p.name.length < 3) throw new HttpError(400, 'Escribe tu nombre completo.');
  if (p.doc.length < 4) throw new HttpError(400, 'Escribe un número de documento válido.');
  if (p.phone.replace(/\D/g, '').length < 7) throw new HttpError(400, 'Escribe un número de celular válido.');
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(p.email)) throw new HttpError(400, 'Escribe un correo electrónico válido.');
  if (p.barrio.length < 2) throw new HttpError(400, 'Escribe tu barrio.');
  if (b.adult !== true) throw new HttpError(400, 'El evento es solo para mayores de 18 años.');
  if (b.consent !== true) throw new HttpError(400, 'Debes aceptar el tratamiento de datos para inscribirte.');
  return p;
}

module.exports = handler({
  async POST(req, res) {
    const p = readPerson(await readBody(req));
    const rec = { code: newCode(), ...p, createdAt: new Date().toISOString() };
    const up = await uploadJson(`${REGS_PREFIX}${p.doc}.json`, rec, {
      overwrite: 'false',
      tags: 'inscrito',
      context: contextString({ code: rec.code, name: p.name, docType: p.docType, doc: p.doc, phone: p.phone, email: p.email, barrio: p.barrio, city: p.city, ref: p.ref, createdAt: rec.createdAt }),
    });
    if (up.existing) {
      const prev = await getJson(up.secure_url);
      if (prev.email !== p.email) throw new HttpError(409, 'Este documento ya está inscrito. Si es tuyo, escríbenos por WhatsApp y te ayudamos.');
      return send(res, 200, { code: prev.code, name: prev.name, email: prev.email, existing: true, emailSent: false });
    }
    send(res, 200, { code: rec.code, name: rec.name, email: rec.email, emailSent: false });
  },
});
