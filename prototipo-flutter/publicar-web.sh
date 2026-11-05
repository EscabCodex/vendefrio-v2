#!/bin/sh
# Compila la versión web y la deja en publicado/ (la sirve la vista previa de Vercel).
set -e
cd "$(dirname "$0")"
flutter build web --release --base-href /prototipo-flutter/publicado/ --no-web-resources-cdn
rm -rf publicado && cp -r build/web publicado
cd publicado
rm -f canvaskit/*.symbols canvaskit/*/*.symbols canvaskit/skwasm* canvaskit/wimp*
rm -rf canvaskit/webparagraph
