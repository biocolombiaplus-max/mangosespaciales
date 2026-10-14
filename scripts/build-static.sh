#!/bin/sh
# Arma la versión estática del sitio (sin servidor) en dist/ para Netlify o Vercel.
# El panel /crm necesita el servidor Node, por eso no se incluye aquí.
set -e
rm -rf dist
mkdir -p dist
cp after.html index.html evento.html legal.html dist/
cp -r css js assets dist/
rm -f dist/js/crm.js dist/js/admin.js dist/css/crm.css dist/css/admin.css
echo "Sitio estático listo en dist/"
