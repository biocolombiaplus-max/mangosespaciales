// GET /api/public/event · patrocinadores visibles para la landing (caché corta en el CDN de Vercel).
const { creds, readSponsors, send, handler } = require('../_lib/cloud');

module.exports = handler({
  async GET(req, res) {
    if (!creds()) return send(res, 200, { storage: null, sponsors: [], sponsorConfig: {} });
    const d = await readSponsors();
    send(res, 200, { storage: 'cloudinary', sponsors: d.sponsors.filter((s) => s.active !== false), sponsorConfig: d.sponsorConfig }, 'public, s-maxage=15, stale-while-revalidate=120');
  },
});
