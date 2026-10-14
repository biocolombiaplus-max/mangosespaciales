#!/bin/sh
# Arma la versión pública (sin servidor) de la landing del evento en dist/,
# lista para Vercel o Netlify. Solo incluye lo que necesita el público.
set -e
rm -rf dist
mkdir -p dist/css dist/js/vendor dist/assets/after
# la landing queda como página principal del sitio
cp after.html dist/index.html
cp terminos.html dist/
cp css/after.css dist/css/
cp js/after.js js/after-config.js dist/js/
cp js/vendor/qrcode-generator.js dist/js/vendor/
cp assets/mango-logo.svg dist/assets/
cp assets/after/*.jpg dist/assets/after/
echo "Landing lista en dist/"
