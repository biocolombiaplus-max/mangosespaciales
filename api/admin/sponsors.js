// GET/PUT /api/admin/sponsors · lista completa de patrocinadores y ajustes del banner.
const { requireAdmin, readSponsors, saveSponsors, readBody, send, handler } = require('../_lib/cloud');

module.exports = handler({
  async GET(req, res) {
    requireAdmin(req);
    send(res, 200, await readSponsors({ fresh: true }));
  },
  async PUT(req, res) {
    requireAdmin(req);
    send(res, 200, await saveSponsors(await readBody(req)));
  },
});
