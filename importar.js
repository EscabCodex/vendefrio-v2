// VendeFrío - Importar desde Excel (T84).
// Más > "Importar planilla": productos (nombre, marca, precio) o comercios
// (nombre, dirección, teléfono) desde un .xlsx o un .csv. Primero muestra
// qué entendió y qué va a cambiar; nada se guarda hasta "Importar".
// Los .xlsx se leen con SheetJS, que se descarga solo la primera vez que
// hace falta (los .csv no necesitan nada).
(function () {
    "use strict";

    const p = window.piezas;
    const SHEETJS = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    const MAXIMO_FILAS = 3000;

    const COLUMNAS = {
        nombre: ["nombre", "producto", "productos", "descripcion", "articulo", "item", "comercio", "cliente", "razon social"],
        marca: ["marca", "proveedor", "fabrica", "linea", "rubro"],
        precio: ["precio", "precio unitario", "pvp", "precio venta", "importe", "valor", "$"],
        unidad: ["unidad", "presentacion", "envase", "u"],
        codigo: ["codigo", "codigo de barras", "ean", "sku"],
        direccion: ["direccion", "domicilio", "calle"],
        telefono: ["telefono", "celular", "whatsapp", "tel"]
    };
    const NOMBRES = { nombre: "Nombre", marca: "Marca", precio: "Precio", unidad: "Unidad", codigo: "Código", direccion: "Dirección", telefono: "Teléfono" };

    const normal = texto => String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

    // ---------- Leer el archivo ----------
    function partirCsv(texto) {
        const primera = texto.split(/\r?\n/)[0] || "";
        const separador = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ";" : (primera.includes("\t") ? "\t" : ",");
        const filas = [];
        let fila = [], celda = "", comillas = false;
        for (let i = 0; i < texto.length; i++) {
            const letra = texto[i];
            if (comillas) {
                if (letra === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
                else if (letra === '"') comillas = false;
                else celda += letra;
            } else if (letra === '"') comillas = true;
            else if (letra === separador) { fila.push(celda); celda = ""; }
            else if (letra === "\n" || letra === "\r") {
                if (letra === "\r" && texto[i + 1] === "\n") i++;
                fila.push(celda); filas.push(fila); fila = []; celda = "";
            } else celda += letra;
        }
        if (celda || fila.length) { fila.push(celda); filas.push(fila); }
        return filas.filter(item => item.some(valor => String(valor).trim()));
    }

    function cargarSheetJs() {
        if (window.XLSX) return Promise.resolve(window.XLSX);
        return new Promise((resolver, rechazar) => {
            const script = document.createElement("script");
            script.src = SHEETJS;
            script.onload = () => window.XLSX ? resolver(window.XLSX) : rechazar(new Error("sin XLSX"));
            script.onerror = () => rechazar(new Error("No se pudo descargar el lector de Excel. Revisá la conexión o guardá la planilla como CSV."));
            document.head.appendChild(script);
        });
    }

    async function leerArchivo(archivo) {
        const nombre = String(archivo.name || "");
        if (/\.(csv|txt|tsv)$/i.test(nombre) || /text\//.test(archivo.type)) {
            return partirCsv(await archivo.text());
        }
        const XLSX = await cargarSheetJs();
        const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });
        const hoja = libro.Sheets[libro.SheetNames[0]];
        return XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: "" })
            .filter(fila => fila.some(valor => String(valor).trim()));
    }

    // ---------- Entender las columnas ----------
    function detectarColumnas(encabezado) {
        const columnas = {};
        encabezado.forEach((titulo, indice) => {
            const texto = normal(titulo);
            Object.keys(COLUMNAS).forEach(clave => {
                if (columnas[clave] !== undefined) return;
                if (COLUMNAS[clave].some(sinonimo => texto === sinonimo || (sinonimo.length > 3 && texto.startsWith(sinonimo)))) columnas[clave] = indice;
            });
        });
        return columnas;
    }

    function leerPrecio(valor) {
        if (typeof valor === "number") return Math.round(valor * 100) / 100;
        let texto = String(valor ?? "").replace(/[^\d.,-]/g, "");
        if (!texto) return 0;
        // "1.234,50" o "1,234.50" o "1234,5".
        if (texto.includes(",") && texto.includes(".")) {
            texto = texto.lastIndexOf(",") > texto.lastIndexOf(".") ? texto.replace(/\./g, "").replace(",", ".") : texto.replace(/,/g, "");
        } else if (texto.includes(",")) {
            texto = /,\d{3}$/.test(texto) ? texto.replace(/,/g, "") : texto.replace(",", ".");
        } else if (/\.\d{3}$/.test(texto)) {
            texto = texto.replace(/\./g, "");
        }
        const numero = Number(texto);
        return Number.isFinite(numero) && numero > 0 ? Math.round(numero * 100) / 100 : 0;
    }

    function analizar(filas) {
        const encabezado = filas[0] || [];
        const columnas = detectarColumnas(encabezado);
        const tipo = columnas.direccion !== undefined || columnas.telefono !== undefined ? "comercios" : "productos";
        const cuerpo = filas.slice(1, MAXIMO_FILAS + 1);
        const celda = (fila, clave) => columnas[clave] === undefined ? "" : fila[columnas[clave]];
        if (columnas.nombre === undefined) return { tipo, columnas, items: [], error: "No encontré la columna del nombre. La primera fila tiene que tener los títulos (por ejemplo: Nombre, Marca, Precio)." };

        if (tipo === "comercios") {
            const existentes = typeof comerciosParaLeer === "function" ? comerciosParaLeer() : [];
            const vistos = new Set();
            const items = cuerpo.map(fila => {
                const nombre = String(celda(fila, "nombre") ?? "").trim().replace(/\s+/g, " ");
                if (!nombre || vistos.has(normal(nombre))) return null;
                vistos.add(normal(nombre));
                const existe = existentes.find(comercio => normal(comercio.nombre) === normal(nombre));
                return {
                    nombre,
                    direccion: String(celda(fila, "direccion") ?? "").trim(),
                    telefono: String(celda(fila, "telefono") ?? "").trim(),
                    estado: existe ? "actualiza" : "nuevo",
                    existe
                };
            }).filter(Boolean);
            return { tipo, columnas, items };
        }

        const productos = typeof productosParaLeer === "function" ? productosParaLeer() : {};
        const vistos = new Set();
        const items = cuerpo.map(fila => {
            const nombreBase = String(celda(fila, "nombre") ?? "").trim().replace(/\s+/g, " ");
            if (!nombreBase) return null;
            const unidad = String(celda(fila, "unidad") ?? "").trim();
            const nombre = unidad && !normal(nombreBase).includes(normal(unidad)) && !/^u(nidad)?$/i.test(unidad) ? nombreBase + " " + unidad : nombreBase;
            const marca = String(celda(fila, "marca") ?? "").trim().replace(/\s+/g, " ") || "General";
            const clave = normal(marca) + "|" + normal(nombre);
            if (vistos.has(clave)) return null;
            vistos.add(clave);
            const precio = leerPrecio(celda(fila, "precio"));
            const marcaExistente = Object.keys(productos).find(item => normal(item) === normal(marca));
            const existe = marcaExistente ? (productos[marcaExistente] || []).find(producto => normal(producto.nombre) === normal(nombre)) : null;
            let estado = existe ? (precio && precio !== Number(existe.precio) ? "actualiza" : "igual") : "nuevo";
            if (!precio && !existe) estado = "sinPrecio";
            return { nombre, marca: marcaExistente || marca, precio, codigo: String(celda(fila, "codigo") ?? "").trim(), estado, existe };
        }).filter(Boolean);
        return { tipo, columnas, items };
    }

    // ---------- Pantalla ----------
    let estado = null;

    function abrir() {
        estado = null;
        const seccion = p.pantalla("pantallaImportar", { titulo: "Importar planilla", sub: "Productos o comercios desde Excel", icono: "planilla", volverA: "mas" });
        p.mostrar(seccion);
        dibujar();
    }

    function paso(numero, titulo, texto, hecho) {
        return `<div class="pasoImportar${hecho ? " hecho" : ""}">
            <span class="numeroPaso">${numero}</span>
            <div><strong>${titulo}</strong><small>${texto}</small></div>
            ${hecho ? p.ico("check", 20) : ""}
        </div>`;
    }

    function textoEstado(item) {
        if (item.estado === "nuevo") return `<b class="estadoImportar nuevo">Nuevo</b>`;
        if (item.estado === "sinPrecio") return `<b class="estadoImportar aviso">Sin precio</b>`;
        if (item.estado === "actualiza") return `<b class="estadoImportar info">${estado.tipo === "productos" ? "Precio nuevo" : "Actualiza"}</b>`;
        return `<b class="estadoImportar igual">Igual</b>`;
    }

    function dibujar() {
        const seccion = document.getElementById("pantallaImportar");
        if (!seccion) return;
        const main = seccion.querySelector("main");
        const elegido = Boolean(estado && estado.items && estado.items.length);
        const columnas = estado && estado.columnas ? Object.keys(estado.columnas).sort((a, b) => estado.columnas[a] - estado.columnas[b]).map(clave => NOMBRES[clave]).join(" · ") : "";
        const pasos = `<div class="pzTarjeta pasosImportar">
            ${paso(1, "Elegí el archivo", estado ? p.esc(estado.archivo) + " · " + estado.filas + (estado.filas === 1 ? " fila" : " filas") : "Excel (.xlsx) o CSV, con los títulos en la primera fila", Boolean(estado))}
            ${paso(2, "Revisá las columnas", columnas || "Nombre, Marca y Precio (o Nombre, Dirección y Teléfono)", elegido)}
            ${paso(3, "Confirmá", "Nada se guarda hasta acá", false)}
        </div>`;
        if (!estado || estado.error) {
            main.innerHTML = pasos +
                (estado && estado.error ? `<div class="pzBanner pzBanPeligro">${p.ico("alerta", 22)}<div><strong>No se pudo leer</strong><small>${p.esc(estado.error)}</small></div></div>` : "") +
                `<label class="pzBtn pzBtnPri botonElegirPlanilla">${p.ico("planilla", 20)}Elegir planilla
                    <input type="file" id="archivoPlanilla" class="pzOcultar" accept=".xlsx,.xls,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel">
                </label>
                <p class="pzHojaSub ayudaImportar">Si un producto ya existe (misma marca y nombre), solo se actualiza el precio. No se borra nada.</p>`;
            main.querySelector("#archivoPlanilla").addEventListener("change", elegirArchivo);
            return;
        }
        const items = estado.items;
        const sinPrecio = items.filter(item => item.estado === "sinPrecio").length;
        const aCambiar = items.filter(item => item.estado !== "igual");
        const muestra = items.slice(0, 40);
        const tabla = estado.tipo === "productos"
            ? `<div class="pzTarjeta tablaImportar">
                <div class="filaTabla cabTabla"><span>Producto</span><span>Precio</span><span></span></div>
                ${muestra.map(item => `<div class="filaTabla"><span>${p.esc(item.nombre)}<small>${p.esc(item.marca)}</small></span><span>${item.precio ? p.plata(item.precio) : "—"}</span>${textoEstado(item)}</div>`).join("")}
                ${items.length > muestra.length ? `<div class="filaTabla masFilas"><span>Y ${items.length - muestra.length} más</span></div>` : ""}
            </div>`
            : `<div class="pzTarjeta tablaImportar">
                <div class="filaTabla cabTabla"><span>Comercio</span><span>Teléfono</span><span></span></div>
                ${muestra.map(item => `<div class="filaTabla"><span>${p.esc(item.nombre)}<small>${p.esc(item.direccion)}</small></span><span>${p.esc(item.telefono || "—")}</span>${textoEstado(item)}</div>`).join("")}
                ${items.length > muestra.length ? `<div class="filaTabla masFilas"><span>Y ${items.length - muestra.length} más</span></div>` : ""}
            </div>`;
        const nombreTipo = estado.tipo === "productos" ? "productos" : "comercios";
        const resumen = `<div class="pzBanner pzBanOk" id="resumenImportar">${p.ico("planilla", 22)}<div>
                <strong>${aCambiar.length} ${nombreTipo} ${aCambiar.length === 1 ? "listo" : "listos"}</strong>
                <small>${[
                    items.filter(item => item.estado === "nuevo" || item.estado === "sinPrecio").length + " nuevos",
                    items.filter(item => item.estado === "actualiza").length + (estado.tipo === "productos" ? " con precio nuevo" : " para actualizar"),
                    sinPrecio ? sinPrecio + " sin precio: se cargan igual y se completan después" : "",
                    items.filter(item => item.estado === "igual").length ? items.filter(item => item.estado === "igual").length + " ya estaban igual" : ""
                ].filter(Boolean).join(" · ")}</small></div></div>`;
        main.innerHTML = pasos + tabla + resumen +
            `<div class="pzBotonesFijos"><button type="button" class="pzBtn pzBtnPri" id="confirmarImportar" ${aCambiar.length ? "" : "disabled"}>${p.ico("check", 20)}Importar ${aCambiar.length} ${nombreTipo}</button></div>`;
        main.querySelector("#confirmarImportar").addEventListener("click", importar);
    }

    async function elegirArchivo(evento) {
        const archivo = evento.target.files && evento.target.files[0];
        if (!archivo) return;
        try {
            const filas = await leerArchivo(archivo);
            const analisis = analizar(filas);
            estado = { archivo: archivo.name, filas: Math.max(0, filas.length - 1), ...analisis };
            if (!analisis.error && !analisis.items.length) estado.error = "La planilla no tiene filas con datos.";
        } catch (error) {
            estado = { archivo: archivo.name, filas: 0, error: error.message || "No se pudo leer el archivo." };
        }
        dibujar();
    }

    function importar() {
        if (!estado || !estado.items) return;
        let hechos = 0;
        const fallas = [];
        if (estado.tipo === "productos") {
            estado.items.filter(item => item.estado !== "igual").forEach(item => {
                let ok;
                if (item.existe) {
                    ok = actualizarProductoPorId(item.existe.id, { precio: item.precio, ...(item.codigo ? { codigo: item.codigo } : {}) });
                } else {
                    const marcas = typeof productosParaLeer === "function" ? productosParaLeer() : obtenerProductos();
                    if (!marcas[item.marca]) agregarMarca(item.marca);
                    ok = agregarProducto(item.marca, { nombre: item.nombre, precio: item.precio, ...(item.codigo ? { codigo: item.codigo } : {}) });
                }
                if (ok) hechos += 1; else fallas.push(item.nombre);
            });
            if (typeof window.renderizarCatalogo === "function") window.renderizarCatalogo();
            if (typeof renderizarPedido === "function") { try { renderizarPedido(); } catch (error) { /* nada */ } }
        } else {
            estado.items.filter(item => item.estado !== "igual").forEach(item => {
                const datos = { nombre: item.nombre, direccion: item.direccion, telefono: item.telefono };
                const ok = item.existe
                    ? actualizarComercioPorId(item.existe.id, { ...(item.direccion ? { direccion: item.direccion } : {}), ...(item.telefono ? { telefono: item.telefono } : {}) })
                    : agregarComercio(datos);
                if (ok) hechos += 1; else fallas.push(item.nombre);
            });
            if (typeof renderizarComercios === "function") { try { renderizarComercios(); } catch (error) { /* nada */ } }
        }
        if (typeof actualizarDashboard === "function") actualizarDashboard();
        const tipo = estado.tipo === "productos" ? "productos" : "comercios";
        p.modal({
            icono: fallas.length ? "alerta" : "check",
            color: fallas.length ? "aviso" : "ok",
            titulo: "Listo: " + hechos + " " + tipo,
            texto: fallas.length ? "No se pudieron guardar " + fallas.length + ": " + fallas.slice(0, 5).join(", ") + (fallas.length > 5 ? "…" : "") + "." : "Ya están en " + (tipo === "productos" ? "el catálogo" : "Comercios") + ".",
            botones: [{ texto: "Ver " + (tipo === "productos" ? "el catálogo" : "comercios"), alTocar: () => mostrarPantalla(tipo === "productos" ? "catalogo" : "comercios") }]
        });
        estado = null;
        dibujar();
    }

    (window.accesosMasExtras = window.accesosMasExtras || []).push({
        destino: "importar", icono: "planilla", texto: "Importar planilla",
        mostrar: () => !(typeof usaNubeReal === "function" && usaNubeReal()) || p.esDueno() || Boolean(window.empleadosVendeFrio?.puede?.("editaCatalogo")),
        abrir
    });

    window.importarVendeFrio = { abrir, analizar, partirCsv, leerPrecio };
}());
