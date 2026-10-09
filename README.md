# 🥭🚀 Mangos Espaciales · Landing de eventos

Landing page de eventos con boletería y panel administrativo. HTML + CSS + JavaScript, sin instalaciones.

## Qué incluye

**Landing (`index.html`)**
- Banner principal con imagen del evento, cuenta regresiva y botones de reserva.
- Cinta de **logos de patrocinadores en el banner**: cada logo abre el link que indique el patrocinador (web, Instagram, Facebook, TikTok, WhatsApp…).
- Experiencia (4 destacados), galería de imágenes, tipos de boleta con cupos en vivo.
- **Reserva de boletas** en una ventana emergente: datos del cliente, cantidad, total, código de reserva y botón para confirmar por WhatsApp.
- Patrocinadores por categoría (Oro / Plata / Aliados), ubicación, redes y botón flotante de WhatsApp.
- Adaptada a celular.

**Panel administrativo (`admin.html`)** · PIN inicial `1234`
- **Resumen**: reservas, ingresos confirmados y por confirmar, ocupación por boleta.
- **Evento**: nombre, frase, descripción, fecha, lugar, mapa y destacados.
- **Imágenes**: subir o pegar URL de la imagen principal y de las imágenes secundarias; ordenar, eliminar o convertir una en principal.
- **Patrocinadores**: crear, editar, ordenar y eliminar; logo (subido o URL), link, categoría y si sale en el banner.
- **Boletas**: tipos, precio, cupos, etiqueta y beneficios.
- **Reservas**: búsqueda, cambio de estado (pendiente / pagada / cancelada), WhatsApp directo y exportar a Excel (CSV).
- **Ajustes**: marca, moneda, WhatsApp, redes, PIN, respaldo y restauración.

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
index.html        Landing
admin.html        Panel administrativo
css/styles.css    Estilos de marca y landing
css/admin.css     Estilos del panel
js/store.js       Datos (localStorage hoy, backend mañana)
js/main.js        Lógica de la landing y reservas
js/admin.js       Lógica del panel
assets/           Logo / mascota
docs/             Prompt del logo y paleta
```
