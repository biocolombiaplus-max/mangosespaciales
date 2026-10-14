// GET /api/admin/registrations · inscritos guardados en Cloudinary (más recientes primero).
const { requireAdmin, adminGet, REGS_PREFIX, send, handler } = require('../_lib/cloud');

module.exports = handler({
  async GET(req, res) {
    requireAdmin(req);
    const list = [];
    let cursor = '';
    for (let page = 0; page < 20; page++) {
      const q = new URLSearchParams({ prefix: REGS_PREFIX, max_results: '500', context: 'true' });
      if (cursor) q.set('next_cursor', cursor);
      const d = await adminGet(`resources/raw/upload?${q}`);
      if (!d) break;
      for (const r of d.resources || []) {
        const c = (r.context && r.context.custom) || {};
        list.push({ ...c, createdAt: c.createdAt || r.created_at });
      }
      cursor = d.next_cursor;
      if (!cursor) break;
    }
    list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    send(res, 200, { registrations: list });
  },
});
