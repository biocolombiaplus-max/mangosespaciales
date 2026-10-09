# 🥭🚀 Mangos Espaciales · Plataforma de eventos

Sitio de boletería y organización de eventos con panel administrativo. HTML + CSS + JavaScript, sin instalaciones.

## Qué incluye

**Inicio (`index.html`)**
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

## Cómo verla

Abre `index.html` en el navegador, o levanta un servidor local:

```bash
npx http-server -p 8080
# http://localhost:8080  y  http://localhost:8080/admin.html
```

Para publicarla gratis: GitHub Pages, Netlify o Vercel (sube la carpeta tal cual).

## ⚠️ Importante antes de vender boletas reales

En esta versión los datos se guardan **en el navegador** (`localStorage`). Sirve para diseñar y probar, pero:
- lo que se edita en el panel solo se ve en ese mismo navegador;
- las reservas de los clientes no llegan al panel desde otros dispositivos;
- el PIN no es seguridad real.

El siguiente paso es conectar un backend (recomendado **Supabase** o **Firebase**) y una pasarela de pagos (Wompi, Mercado Pago, ePayco o Bold). Todo el acceso a datos está en `js/store.js`, así que solo se cambia ese archivo.

## Logo

`assets/mango-logo.svg` es provisional. El prompt para generar la mascota definitiva está en [`docs/PROMPT_LOGO_MANGO.md`](docs/PROMPT_LOGO_MANGO.md).

## Estructura

```
index.html        Inicio y cartelera
evento.html       Detalle del evento y compra
legal.html        Términos y política de datos
admin.html        Panel administrativo
css/styles.css    Estilos del sitio
css/admin.css     Estilos del panel
js/store.js       Datos (localStorage hoy, backend mañana)
js/ui.js          Encabezado, pie de página y componentes compartidos
js/main.js        Inicio
js/event.js       Página de evento y reservas
js/admin.js       Panel
assets/           Logo / mascota
docs/             Prompt del logo y paleta
```
