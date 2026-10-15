# Publicar la landing (gratis) · Vercel + Cloudinary

- **Vercel** publica la página y ejecuta las funciones de `/api` (gratis, sin servidor que mantener).
- **Cloudinary** guarda los logos de los patrocinadores, sus enlaces y ajustes, y las inscripciones.
- Las **mesas** se reservan solo por **WhatsApp**: los botones "Reservar mi mesa" abren un mensaje listo para el 300 508 1812.

Tiempo total: unos 10 minutos. No necesitas tarjeta de crédito.

---

## Paso 1 · Publicar en Vercel

1. Entra a **https://vercel.com/signup** y regístrate con **GitHub** (plan *Hobby*, gratis).
2. **Add New… → Project** → **Import** en `mangosespaciales`. No cambies nada: `vercel.json` ya trae la configuración.
3. Pulsa **Deploy**. Cada cambio que se sube a GitHub se publica solo.

## Paso 2 · Conectar Cloudinary (una sola vez)

1. Crea tu cuenta gratis en **https://cloudinary.com/users/register_free** (puedes entrar con Google).
2. En Cloudinary: **Settings → API Keys**. Copia la **API environment variable**, que se ve así:
   `CLOUDINARY_URL=cloudinary://123456789:AbCdEf…@tu-nube`
3. En Vercel: tu proyecto → **Settings → Environment Variables**:
   - **Key:** `CLOUDINARY_URL` · **Value:** lo que copiaste (con o sin `CLOUDINARY_URL=` al inicio).
   - Opcional: **Key:** `ADMIN_PASSWORD` · **Value:** tu clave del panel. Si no la pones, la clave es `123456`.
4. **Deployments → ⋯ → Redeploy** en el último despliegue.

Si entras al panel antes de hacer esto, el mismo panel te muestra estos pasos y un botón para comprobar la conexión.

> 🔒 Las claves de Cloudinary quedan solo en Vercel. Nunca se publican en la página ni hay que enviárselas a nadie.

## Paso 3 · Probar antes de compartir

1. En el pie de página pulsa **🔐 Iniciar sesión** (o entra a `/admin-patrocinadores.html`) con tu clave.
2. Sube un logo de prueba, ponle un enlace y pulsa **Guardar y publicar**. En menos de 1 minuto aparece en la landing.
3. Inscríbete en la landing y revisa la pestaña **Inscritos** del panel.
4. Toca **Reservar mi mesa** y revisa que se abra WhatsApp con el mensaje listo.

---

## Panel administrativo

**⭐ Patrocinadores**
- **Agregar patrocinador:** sube el logo (PNG, JPG, WEBP o SVG). Se recorta solo el espacio vacío y, si tiene fondo blanco, marca *Quitar fondo blanco*. El logo sube directo a Cloudinary (carpeta `after/logos`) y se entrega optimizado (`f_auto,q_auto`).
- Por cada logo: nombre, **enlace** al tocarlo (web, Instagram, WhatsApp…), **tamaño**, **borde blanco**, **fondo de la tarjeta**, **destacado** y **visible**. También puedes pegar la URL de un logo que ya esté en internet (https).
- **Vista previa en vivo** antes de publicar.
- Dónde aparecen: banner superior, franja "Con el respaldo de", franja "Aliados del evento" y, los destacados, en grande en "Patrocinadores oficiales".

**🎟️ Inscritos**
- Total, inscritos de hoy y barrios distintos; búsqueda por nombre, documento, código, barrio o correo.
- WhatsApp directo de cada persona y **Exportar a Excel** (CSV).

## Inscripciones

> **Hoy las inscripciones van por EventosID.** En `js/after-config.js`, `registroUrl` apunta al módulo `https://eventosid.com/evento/donde-es-el-after/embed`. Los botones "Inscribirme" y "Recuperar mi QR" lo abren dentro de una ventana de la landing, con el mismo estilo. Allí quedan los datos, el QR y la recuperación con documento + correo. Si dejas `registroUrl: ''`, vuelve el formulario propio descrito abajo.


- Cada persona se inscribe una vez por documento. Si repite con el mismo documento y correo, ve de nuevo su código; con otro correo, se le pide escribir por WhatsApp.
- Al inscribirse ve su **QR en pantalla** y descarga su **entrada** (imagen con QR, código, fecha y lugar). Por ahora no se envían correos: eso llega con el servidor propio.
- En Cloudinary cada inscripción es un archivo en `after/inscritos/` (Media Library → Raw).

**Límites del plan gratis de Cloudinary:** 25 créditos al mes (de sobra para logos e inscripciones) y 500 consultas por hora al API de administración; la landing guarda en caché los patrocinadores para no acercarse a ese límite.

## Cuando tengas el servidor y el dominio

1. Publica el servidor de Node (ver el README): CRM, campañas, correos con QR y control de ingreso con cámara.
2. Exporta los inscritos desde el panel e impórtalos en **/crm → CRM → Importar base**.
3. En Vercel, **Settings → Domains** conecta tu dominio propio.

> El plan gratis de Vercel es para proyectos no comerciales. Cuando el evento crezca, pasa a *Pro* o usa Netlify.
>
> La carpeta `google-apps-script/` queda como alternativa con Google Sheets; hoy no se usa.
