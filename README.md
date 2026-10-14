# 🥭🚀 Mangos Espaciales · Plataforma de eventos

Sitio de boletería y organización de eventos: landing de eventos, inscripciones, mesas, CRM y campañas de correo. Node.js + HTML/CSS/JS.

## Qué incluye

**Cartelera (`cartelera.html`)**
- Encabezado con buscador de eventos, menú, "Mi reserva" y botón de compra.
- Carrusel de eventos destacados con fecha, lugar, precio "desde" y botones de compra.
- Franja de **patrocinadores oficiales**: cada logo abre el enlace del patrocinador (web, Instagram, Facebook, TikTok, WhatsApp…).
- Cartelera con filtros por categoría, ciudad y precio.
- Cifras, "Compra en 4 pasos", sección **Organiza tu evento** con formulario de cotización por WhatsApp.
- Patrocinadores por categoría, testimonios, preguntas frecuentes, suscripción a preventas y pie de página con medios de pago.

**Página de evento (`evento.html?id=…`)**
- Póster, datos clave, cuenta regresiva, agregar al calendario y compartir.
- Descripción, agenda, galería ampliable, mapa de Google, información importante y patrocinadores.
- Caja de compra con varios tipos de boleta y cantidades, total, formulario del comprador y código de reserva con confirmación por WhatsApp.
- Barra de compra fija en celular y datos estructurados para Google.

**Consultar reserva**: con código + documento, desde el menú o el pie de página.

**Legal (`legal.html`)**: términos de compra y política de datos (Ley 1581). Plantilla: debe revisarla un abogado.

**Panel administrativo (`admin.html`)** · PIN inicial `1234`
- **Resumen**: eventos, reservas, ingresos confirmados y por confirmar, ventas por evento.
- **Eventos**: crear, editar, duplicar y eliminar. Información, estado (publicado/borrador/agotado), destacado en banner, imagen principal e imágenes secundarias (subir o URL), boletas y agenda.
- **Patrocinadores**: logo (subido o URL), enlace, categoría, orden y si sale en el banner.
- **Reservas**: filtro por evento, búsqueda, estado (pendiente/pagada/cancelada), WhatsApp directo y exportar a Excel.
- **Suscriptores**: lista y exportación.
- **Contenido**: categorías, cifras, testimonios y preguntas frecuentes.
- **Ajustes**: marca, contacto, redes, medios de pago, PIN y respaldo.

## 🎉 ¿Dónde es el After? · Landing, CRM y campañas (requiere el servidor)

**Landing del evento (`index.html`, página principal)**
- Estética de los afiches: amarillo, azul y rojo de Colombia y Venezuela, papel vintage y estilo retro tropical.
- **Entrada gratis con inscripción obligatoria** (seguridad y control de ingreso): formulario rápido, código QR en pantalla y por correo.
- **Reserva de mesas** en un mapa de 30 mesas: las reservadas se bloquean en tiempo real; confirmación con QR por correo.
- Mesas libres en vivo, cuenta regresiva, música que va a sonar, mapa, preguntas frecuentes y botones de WhatsApp.
- **Patrocinadores**: banner superior y dos franjas que giran lento, más sección de destacados. Cada logo abre su enlace.

**Panel de patrocinadores (`admin-patrocinadores.html`)**
- Subir logos con recorte automático y opción de quitar fondo blanco; enlace, tamaño, borde blanco, fondo de tarjeta, destacado y visible por logo; orden con flechas; vista previa en vivo.
- Guarda en Google Sheets + Drive (Vercel) o en el servidor propio, con clave.

**Centro de control (`/crm`)**
- **Resumen**: personas esperadas, inscritos, mesas, ingresos en puerta, embudo y campaña en curso.
- **Inscritos y Mesas**: búsqueda, cancelar/reactivar, reenviar correo, exportar a Excel.
- **Ingreso**: valida el QR con la cámara del celular (Chrome Android) o escribiendo el código/documento; avisa si ya ingresó.
- **CRM tipo Kommo**: tablero con etapas Nuevo → Invitado → Hizo clic → Registrado → Reservó mesa → Baja/rebote. Arrastrar tarjetas, ficha con historial y notas, vista de lista con acciones masivas.
- **Importar base** desde Excel o CSV, con detección de columnas, unión de correos repetidos y etiqueta por base.
- **Campañas de correo**: invitación ya redactada, asuntos rotativos, variaciones automáticas `{Hola|Qué más}`, `{{nombre}}`, vista previa, envío de prueba, revisión anti-spam, **1 correo cada 10+ segundos**, límite diario, enlace de baja y pausa automática ante errores.
- Quien se inscribe (o hace clic) **sale automáticamente de los envíos**: el botón del correo lleva un enlace de seguimiento que une la inscripción con el contacto, aunque use otro correo.

### Correr en tu computador

```bash
npm install
npm start
# Landing:  http://localhost:3000
# Panel:    http://localhost:3000/crm   (la contraseña aparece en la consola)
```

Sin configurar SMTP todo funciona en **modo prueba**: los correos se guardan en *Ajustes → Bandeja de prueba* para verlos.

### Publicar hoy, gratis (sin servidor)

La landing funciona sola en **Vercel** (o Netlify) guardando inscripciones y mesas en **Google Sheets** (con correo de confirmación desde Gmail). Guía paso a paso: [`docs/PUBLICAR.md`](docs/PUBLICAR.md).

### Publicar con servidor propio (CRM y campañas)

Necesitas un hosting que ejecute Node.js 20+ **con disco persistente** (los datos viven en `data/db.json`):
- **Railway** o **Render** (con disco persistente montado en `DATA_DIR`), o un VPS.
- Comando de inicio: `npm start`. Variables: ver [`.env.example`](.env.example).

### Para que los correos no caigan en spam
1. Usa un correo con tu dominio (hola@tudominio.com) y un proveedor de envío (Brevo, Amazon SES, Zoho o Google Workspace).
2. Configura **SPF, DKIM y DMARC** en el DNS del dominio con los registros que te da el proveedor.
3. Calienta el dominio: 50–100 correos el primer día y sube poco a poco.
4. Envía solo a contactos que autorizaron recibir comunicaciones (Ley 1581 de 2012).

## Plataforma general (cartelera)

`cartelera.html`, `evento.html` y `admin.html` siguen funcionando como antes (datos en el navegador).

## Logo

`assets/mango-logo.svg` es provisional. El prompt para generar la mascota definitiva está en [`docs/PROMPT_LOGO_MANGO.md`](docs/PROMPT_LOGO_MANGO.md).

## Estructura

```
cartelera.html    Cartelera de eventos (plataforma general)
evento.html       Detalle del evento y compra
legal.html        Términos y política de datos
admin.html        Panel administrativo
css/styles.css    Estilos del sitio
css/admin.css     Estilos del panel
index.html        Landing ¿Dónde es el After? (página principal)
crm.html          Centro de control (CRM, campañas, ingreso)
css/after.css     Estilos de la landing del evento
css/crm.css       Estilos del centro de control
js/after.js       Inscripción y mesas
js/after-config.js  Dónde se guardan las inscripciones (Google Sheets o servidor)
google-apps-script/ Script para guardar en Google Sheets
vercel.json       Publicación en Vercel (netlify.toml para Netlify)
terminos.html     Términos y datos personales del evento
admin-patrocinadores.html  Panel de patrocinadores
js/sponsors.js    Banner y franjas de patrocinadores (landing y vista previa)
scripts/          Arma la versión pública en dist/
js/crm.js         Centro de control
server/           Servidor: API, correo, CRM y campañas
assets/after/     Afiches del evento
js/store.js       Datos (localStorage hoy, backend mañana)
js/ui.js          Encabezado, pie de página y componentes compartidos
js/main.js        Inicio
js/event.js       Página de evento y reservas
js/admin.js       Panel
assets/           Logo / mascota
docs/             Prompt del logo y paleta
```
