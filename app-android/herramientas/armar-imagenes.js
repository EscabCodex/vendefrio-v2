// Arma las imágenes base del ícono y la pantalla de inicio a partir del
// copo de nieve de icon.svg. Después: npm run iconos (las pasa a Android).
const sharp = require("sharp");
const path = require("path");
const salida = path.join(__dirname, "..", "assets");

const degradado = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14A098"/><stop offset="1" stop-color="#0B615F"/></linearGradient></defs>`;
const copo = `<g stroke="#fff" stroke-width="26" stroke-linecap="round" fill="none"><path d="M256 130v252M141 185l230 142M371 185L141 327M256 130l-34 40M256 130l34 40M256 382l-34-40M256 382l34-40M141 185l52 6M141 185l14 51M371 327l-52-6M371 327l-14-51M371 185l-52 6M371 185l-14 51M141 327l52-6M141 327l14-51"/></g>`;

// El copo ocupa ~50% en icon.svg; en el ícono adaptable tiene que quedar
// dentro del círculo seguro (66% del centro), así que se achica un poco.
const svg = (contenido, tam = 1024) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 512 512">${contenido}</svg>`);
const copoAchicado = escala => `<g transform="translate(256 256) scale(${escala}) translate(-256 -256)">${copo}</g>`;

(async () => {
    await sharp(svg(`${degradado}<rect width="512" height="512" fill="url(#g)"/>${copo}`)).png().toFile(path.join(salida, "icon-only.png"));
    await sharp(svg(copoAchicado(1.35))).png().toFile(path.join(salida, "icon-foreground.png"));
    await sharp(svg(`${degradado}<rect width="512" height="512" fill="url(#g)"/>`)).png().toFile(path.join(salida, "icon-background.png"));
    const splash = `${degradado}<rect width="512" height="512" fill="url(#g)"/>${copoAchicado(0.32)}`;
    await sharp(svg(splash, 2732)).png().toFile(path.join(salida, "splash.png"));
    await sharp(svg(splash, 2732)).png().toFile(path.join(salida, "splash-dark.png"));
    console.log("Listo");
})();
