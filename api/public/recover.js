// POST /api/public/recover · recupera el QR con documento + correo, sin volver a inscribirse.
const { REGS_PREFIX, HttpError, adminGet, getJson, readBody, send, handler } = require('../_lib/cloud');

const NOT_FOUND = 'No encontramos una inscripción con ese documento y correo. Revisa los datos o escríbenos por WhatsApp.';

module.exports = handler({
  async POST(req, res) {
    const b = await readBody(req);
    const doc = String(b.doc || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 15);
    const email = String(b.email || '').trim().toLowerCase();
    if (doc.length < 4 || !email.includes('@')) throw new HttpError(400, 'Escribe tu documento y tu correo.');
    const meta = await adminGet(`resources/raw/upload/${REGS_PREFIX}${doc}.json`);
    if (!meta) {
      await new Promise((r) => setTimeout(r, 400)); // misma demora exista o no el documento
      throw new HttpError(404, NOT_FOUND);
    }
    const rec = await getJson(meta.secure_url);
    if (rec.email !== email) throw new HttpError(404, NOT_FOUND);
    send(res, 200, { code: rec.code, name: rec.name, email: rec.email, existing: true, recovered: true, emailSent: false });
  },
});
