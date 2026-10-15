// GET /api/admin/image-proxy?url=…&t=TOKEN · trae una imagen de otro sitio para el
// generador de historias: sin cabeceras CORS el navegador no deja exportar el lienzo.
// Solo para el panel (pide la sesión en ?t= porque <img> no envía cabeceras).
const { requireAdmin, HttpError, handler } = require('../_lib/cloud');

const MAX = 8 * 1024 * 1024;

module.exports = handler({
  async GET(req, res) {
    const q = new URL(req.url, 'http://x').searchParams;
    requireAdmin({ headers: { authorization: 'Bearer ' + (q.get('t') || '') } });
    const url = q.get('url') || '';
    if (!/^https:\/\/[^\s]+$/i.test(url)) throw new HttpError(400, 'URL de imagen no válida.');
    let r;
    try {
      r = await fetch(url, { redirect: 'follow' });
    } catch (e) {
      throw new HttpError(502, 'No se pudo descargar la imagen.');
    }
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !/^image\//i.test(type)) throw new HttpError(502, 'El enlace no es una imagen.');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX) throw new HttpError(413, 'La imagen es demasiado pesada.');
    res.statusCode = 200;
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(buf);
  },
});
