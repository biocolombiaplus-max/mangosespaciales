# Prompt del logo / mascota: "Mango Espacial"

El archivo `assets/mango-logo.svg` es un logo **provisional** hecho en código para que la web ya se vea con identidad. Para el logo definitivo, genera la mascota con IA usando estos prompts y luego reemplaza el archivo, o mándalo a vectorizar.

---

## 1. Prompt principal (Midjourney / DALL·E / Ideogram / Leonardo / Firefly)

```
Premium 3D cartoon mascot of a cheerful, extroverted mango character, full body, front 3/4 view.
Juicy glossy mango body with a vibrant gradient from sunny yellow (#FFD21A) to bright orange (#FF7A00)
with a soft pink-red blush (#FF3D6E) on one side, subtle realistic skin texture and a shiny highlight.
A fresh lime-green leaf (#7CFF3B) and a short stem on top of the head, slightly tilted like a cool hairstyle.
Big expressive eyes with sparkling highlights, confident raised eyebrows, wide open happy smile showing
a little pink tongue, rosy cheeks. Small white cartoon gloves (Mickey-style), one hand waving hello and
the other giving a thumbs up. Thin dark-purple arms and legs, wearing chunky neon sneakers in magenta
and electric purple. Dynamic, energetic pose, slightly jumping, full of personality.
A thin glowing orbit ring in cyan-to-magenta gradient circling around the mango like a small planet,
with tiny sparkles and stars — space party vibe.
Style: modern Pixar/Disney-quality 3D character, smooth soft lighting, clean bold silhouette, vivid
saturated colors, playful but professional, premium brand mascot, highly detailed, sharp focus.
Isolated on a plain solid white background, centered, no text, no watermark.
```

**Parámetros recomendados**
- Midjourney: `--ar 1:1 --style raw --v 7 --s 250` (agrega `--no text, watermark, background clutter`)
- DALL·E / ChatGPT: pide "fondo blanco liso" o "fondo transparente PNG".
- Ideogram: estilo **3D** o **Render**, "Magic Prompt" desactivado.

---

## 2. Versión logo plano (para redes, sellos, bordados, impresión)

```
Flat vector logo mascot of a happy extroverted mango character with face, arms and legs,
bold thick dark-purple outlines (#2A1145), flat colors with a single highlight: mango gradient yellow-orange
with pink blush, lime green leaf on top, big sparkling eyes, wide smile, one hand waving, one thumbs up,
neon magenta sneakers, a cyan-to-pink orbit ring around the body like a planet, small four-point stars.
Sticker style, clean shapes, minimal details, perfectly centered, iconic and readable at small sizes,
modern youthful premium brand identity, white background, no text.
```

Parámetros: `--ar 1:1 --style raw` · luego vectoriza en **Vectorizer.ai** o Illustrator (Image Trace) para tener SVG.

---

## 3. Variaciones útiles para la marca

| Uso | Agrega al final del prompt |
|---|---|
| Foto de perfil redes | `circular badge composition, character inside a glowing gradient circle (purple to magenta), centered` |
| Con casco astronauta | `wearing a transparent astronaut bubble helmet, tiny jetpack, floating in space` |
| Eventos / DJ | `wearing headphones and holding a microphone, party lights` |
| Salud / laboratorio | `wearing a tiny white lab coat and stethoscope, friendly and trustworthy` |
| Marketing | `holding a megaphone, confident pose, motion lines` |
| Pack de stickers | `character sheet, 6 different expressions and poses: happy, winking, surprised, thumbs up, dancing, thinking, consistent design` |

> Para que todas las variaciones salgan con **el mismo personaje**: en Midjourney usa la imagen elegida como referencia con `--cref URL_DE_TU_MANGO --cw 100`; en ChatGPT pide "mantén exactamente el mismo personaje".

---

## 4. Paleta oficial

| Color | HEX | Uso |
|---|---|---|
| Mango | `#FFB800` | Principal, botones |
| Naranja | `#FF6B00` | Degradados |
| Rosa neón | `#FF2E93` | Acentos, CTA secundarios |
| Cian eléctrico | `#00E5FF` | Detalles, links |
| Lima | `#B6FF3B` | Estados, hoja |
| Violeta | `#7B2FFF` | Degradados de fondo |
| Espacio | `#0D0221` | Fondo |

Tipografías: **Unbounded** (títulos) + **Outfit** (texto). Ambas gratis en Google Fonts.

---

## 5. Entregables a exportar

- `mango-logo.svg` (vector, reemplaza el de `assets/`)
- PNG 1024×1024 fondo transparente
- Foto de perfil 1080×1080 con fondo degradado
- Versión horizontal: mango + texto "Mangos Espaciales"
- Favicon 512×512
