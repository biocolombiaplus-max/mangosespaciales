// POST /api/admin/login · clave del panel (ADMIN_PASSWORD en Vercel; por defecto 123456).
const { need, adminPassword, same, makeToken, readBody, send, handler, HttpError } = require('../_lib/cloud');

module.exports = handler({
  async POST(req, res) {
    need();
    const { password } = await readBody(req);
    if (!same(password || '', adminPassword())) {
      await new Promise((r) => setTimeout(r, 800)); // frena los intentos repetidos
      throw new HttpError(401, 'Clave incorrecta.');
    }
    send(res, 200, { token: makeToken() });
  },
});
