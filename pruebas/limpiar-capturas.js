// VendeFrío - Antes de cada corrida, borra las capturas viejas: así la
// carpeta "capturas" tiene solo las de esta tarea y no se acumulan.
const fs = require("fs");
const path = require("path");

module.exports = function limpiarCapturas() {
    const carpeta = path.resolve(__dirname, "..", "capturas");
    if (!fs.existsSync(carpeta)) return;
    fs.readdirSync(carpeta)
        .filter(archivo => archivo.endsWith(".jpg"))
        .forEach(archivo => fs.unlinkSync(path.join(carpeta, archivo)));
};
