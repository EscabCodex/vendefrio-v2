# VendeFrío para Android (Capacitor)

App de Android que abre la web de VendeFrío sin la barra del navegador.
Como abre la web, **los cambios de la web llegan solos** (igual que la PWA).
Solo hay que armar un APK nuevo cuando cambia algo de esta carpeta.

- Dirección que abre: `server.url` en `capacitor.config.json` (hoy, la de `desarrollo`).
  Para pasar a la de `main`, cambiarla ahí y en `www/sin-conexion.html`.
- Ícono y pantalla de inicio: `node herramientas/armar-imagenes.js` y después
  `npx capacitor-assets generate --android --iconBackgroundColor '#0B615F' --iconBackgroundColorDark '#0B615F' --splashBackgroundColor '#0B615F' --splashBackgroundColorDark '#0B615F'`.
- El APK lo arma GitHub (`.github/workflows/app-android-apk.yml`) en cada cambio de
  esta carpeta y lo deja en la versión `app-android` de GitHub Releases.
- No trae código nativo propio, así que un solo APK sirve en celulares de 32 y 64 bits.
- `android/app/llave-de-prueba.jks` es una llave SOLO de prueba (sirve para instalar
  cada APK nuevo encima del anterior). Para Play Store hace falta otra, guardada como secreto.
