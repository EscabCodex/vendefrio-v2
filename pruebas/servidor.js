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
    ".ico": "image/x-icon",
    ".woff2": "font/woff2"
};

// Para la prueba de arranque (T150): la prueba puede volver lenta la "señal"
// o cambiar un archivo como si se hubiera publicado una versión nueva, sin
// tocar el repo. "/__pruebas/normal" deja todo como siempre.
const simulado = { demora: 0, agregados: {} };

function controlDePruebas(direccion, respuesta) {
    if (direccion.pathname === "/__pruebas/lento") simulado.demora = Number(direccion.searchParams.get("ms")) || 0;
    if (direccion.pathname === "/__pruebas/cambiar") simulado.agregados[direccion.searchParams.get("archivo")] = direccion.searchParams.get("texto") || "";
    if (direccion.pathname === "/__pruebas/normal") { simulado.demora = 0; simulado.agregados = {}; }
    respuesta.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    respuesta.end("ok");
}

http.createServer((pedido, respuesta) => {
    const direccion = new URL(pedido.url, "http://localhost");
    if (direccion.pathname.startsWith("/__pruebas/")) {
        controlDePruebas(direccion, respuesta);
        return;
    }
    if (simulado.demora) setTimeout(() => servir(pedido, respuesta), simulado.demora);
    else servir(pedido, respuesta);
}).listen(puerto, "127.0.0.1", () => {
    console.log(`App de prueba en http://127.0.0.1:${puerto}`);
});

function servir(pedido, respuesta) {
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
    const agregado = simulado.agregados[ruta.replace(/^\//, "")];
    if (agregado !== undefined) {
        respuesta.end(fs.readFileSync(archivo, "utf8") + "\n" + agregado);
        return;
    }
    fs.createReadStream(archivo).pipe(respuesta);
}
