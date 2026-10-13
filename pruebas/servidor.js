// Servidor chico para las pruebas automáticas (W1): sirve la app tal cual
// está en el repo, sin dependencias y sin tocar ningún archivo.
const http = require("http");
const fs = require("fs");
const path = require("path");

const raiz = path.resolve(__dirname, "..");
const puerto = Number(process.env.PUERTO_PRUEBAS || 4173);
const tipos = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon"
};

http.createServer((pedido, respuesta) => {
    const ruta = decodeURIComponent(new URL(pedido.url, "http://localhost").pathname);
    const archivo = path.join(raiz, ruta === "/" ? "index.html" : ruta);
    if (!archivo.startsWith(raiz) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
        respuesta.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        respuesta.end("No existe");
        return;
    }
    respuesta.writeHead(200, {
        "Content-Type": tipos[path.extname(archivo)] || "application/octet-stream",
        "Cache-Control": "no-store"
    });
    fs.createReadStream(archivo).pipe(respuesta);
}).listen(puerto, "127.0.0.1", () => {
    console.log(`App de prueba en http://127.0.0.1:${puerto}`);
});
