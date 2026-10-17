// VendeFrío - Foto de la heladera (T92).
// En la ficha del comercio, "Exhibición": una foto de cómo está puesta la
// mercadería en cada visita, con un comentario y si está bien puesta. Abajo
// quedan las anteriores, con fecha, para comparar. En la nube se guarda en
// `heladeras/` (la foto achicada, como los tickets de gastos).
(function () {
    "use strict";

    const p = window.piezas;
    const extras = window.extrasVendeFrio;
    const NOTAS = [
        { clave: "bien", texto: "Bien puesta", chip: "pzChipOk" },
        { clave: "mejorar", texto: "Para mejorar", chip: "pzChipAviso" },
        { clave: "mal", texto: "Mal puesta", chip: "pzChipPeligro" }
    ];
    const nota = clave => NOTAS.find(item => item.clave === clave) || NOTAS[0];

    extras.registrar("heladeras", {
        dias: 400,
        describir: foto => ({ titulo: "Foto de la heladera", nombre: foto.comercio, detalle: nota(foto.estado).texto })
    });

    let comercioActual = "";

    function fotosDe(nombre) {
        const clave = String(nombre || "").toLocaleLowerCase("es");
        return extras.lista("heladeras")
            .filter(foto => String(foto.comercio || "").toLocaleLowerCase("es") === clave)
            .sort((a, b) => Number(b.horaCelular) - Number(a.horaCelular));
    }

    function cuando(hora) {
        const dia = new Date(hora); dia.setHours(0, 0, 0, 0);
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const dias = Math.round((hoy - dia) / 86400000);
        return (dias === 0 ? "Hoy" : dias === 1 ? "Ayer" : p.fechaCorta(hora)) + " · " + p.hora(hora);
    }

    function dibujar() {
        const seccion = document.getElementById("pantallaHeladera");
        if (!seccion) return;
        const main = seccion.querySelector("main");
        const comercio = typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(comercioActual) : null;
        const fotos = fotosDe(comercioActual);
        const ultima = fotos[0];
        const cabecera = `<div class="pzTarjeta comercioHeladera">
            <div class="pzIni ${p.colorIni(comercioActual)}">${p.esc(p.iniciales(comercioActual))}</div>
            <div class="pzFilaTxt"><strong>${p.esc(comercioActual)}</strong><small>${p.esc(comercio && comercio.direccion ? "Heladera · " + comercio.direccion : "Heladera y exhibición")}</small></div>
        </div>`;
        const principal = ultima
            ? `<div class="pzTarjeta fotoHeladera">
                <button type="button" class="fotoHeladeraGrande" data-ver-foto="${p.esc(ultima.id)}" aria-label="Ver la foto del ${p.esc(cuando(ultima.horaCelular))}"><img src="${p.esc(ultima.foto)}" alt="Heladera de ${p.esc(comercioActual)}"></button>
                <div class="pieFotoHeladera">
                    <div class="pzFilaTxt"><strong>${p.esc(cuando(ultima.horaCelular))}</strong><small>${p.esc((ultima.persona && ultima.persona.nombre ? ultima.persona.nombre : "Vos") + (ultima.nota ? " · “" + ultima.nota + "”" : ""))}</small></div>
                    <span class="pzChip ${nota(ultima.estado).chip}">${nota(ultima.estado).texto}</span>
                </div>
            </div>`
            : `<div class="pzTarjeta sinFotoHeladera">${p.ico("camara", 30)}<strong>Todavía no hay fotos</strong><small>Sacale una foto a la heladera o la góndola en cada visita para ver cómo cambia.</small></div>`;
        const anteriores = fotos.slice(1);
        main.innerHTML = cabecera + principal +
            `<button type="button" class="pzBtn pzBtnPri" id="nuevaFotoHeladera">${p.ico("camara", 20)}Sacar foto</button>` +
            (anteriores.length ? `<section class="bloqueHeladera"><div class="pzBloqueCab"><h2>Fotos anteriores</h2><small>${anteriores.length}</small></div>
                <div class="fotosAnteriores">${anteriores.map(foto => `<button type="button" class="fotoAnterior" data-ver-foto="${p.esc(foto.id)}" aria-label="Foto del ${p.esc(cuando(foto.horaCelular))}">
                    <img src="${p.esc(foto.foto)}" alt=""><span>${p.esc(p.fechaCorta(foto.horaCelular))}</span><i class="puntoHeladera ${nota(foto.estado).clave}"></i></button>`).join("")}</div></section>` : "");
    }

    function abrir(nombre) {
        comercioActual = nombre;
        const seccion = p.pantalla("pantallaHeladera", {
            titulo: "Exhibición", sub: nombre, volverA: "menu",
            accion: { icono: "camara", nombre: "Sacar foto de la heladera", alTocar: () => nueva() }
        });
        if (!seccion.dataset.listo) {
            seccion.dataset.listo = "1";
            seccion.addEventListener("click", evento => {
                if (evento.target.closest("#nuevaFotoHeladera")) nueva();
                const ver = evento.target.closest("[data-ver-foto]");
                if (ver) verFoto(ver.dataset.verFoto);
            });
        }
        p.mostrar(seccion);
        dibujar();
    }

    function nueva() {
        let foto = "";
        let estado = "bien";
        const caja = p.hoja({
            titulo: "Foto de la heladera",
            sub: comercioActual,
            html: `<label class="pzFotoNueva botonFotoHeladera">${p.ico("camara", 26)}<span class="textoFotoHeladera">Sacar o elegir foto</span>
                    <input type="file" accept="image/*" capture="environment" id="archivoHeladera" class="pzOcultar"></label>
                <div class="pzFiltros notasHeladera" role="group" aria-label="¿Cómo está?">${NOTAS.map(item => `<button type="button" class="pzFiltro" data-nota="${item.clave}" aria-pressed="${item.clave === estado}">${item.texto}</button>`).join("")}</div>
                <label class="pzCampo">Comentario (opcional)<input type="text" id="notaHeladera" maxlength="120" placeholder="Por ejemplo: faltan palitos en la segunda fila"></label>`,
            botones: [{
                texto: "Guardar foto", icono: "check",
                alTocar: cajaHoja => {
                    if (!foto) {
                        mostrarToast?.("Sacá la foto primero");
                        return false;
                    }
                    extras.guardar("heladeras", {
                        comercio: comercioActual.slice(0, 80),
                        foto,
                        estado,
                        nota: String(cajaHoja.querySelector("#notaHeladera").value || "").trim().slice(0, 120),
                        persona: p.persona(),
                        horaCelular: Date.now()
                    }, typeof generarId === "function" ? generarId("helad") : undefined);
                    mostrarToast?.("Foto guardada");
                    setTimeout(dibujar, 0);
                    return true;
                }
            }]
        });
        caja.addEventListener("click", evento => {
            const boton = evento.target.closest("[data-nota]");
            if (!boton) return;
            estado = boton.dataset.nota;
            caja.querySelectorAll("[data-nota]").forEach(otro => otro.setAttribute("aria-pressed", String(otro === boton)));
        });
        caja.querySelector("#archivoHeladera").addEventListener("change", async evento => {
            const archivo = evento.target.files && evento.target.files[0];
            if (!archivo) return;
            try {
                foto = await p.comprimirImagen(archivo, { lado: 1100, calidad: 0.62, largoMaximo: 340000 });
            } catch (error) {
                mostrarToast?.("No se pudo usar esa foto.", "error");
                return;
            }
            const etiqueta = caja.querySelector(".botonFotoHeladera");
            etiqueta.classList.add("conFoto");
            etiqueta.style.backgroundImage = `url("${foto}")`;
            caja.querySelector(".textoFotoHeladera").textContent = "Cambiar foto";
        });
    }

    function verFoto(id) {
        const foto = extras.lista("heladeras").find(item => item.id === id);
        if (!foto) return;
        const yo = p.persona();
        const puedeBorrar = p.esDueno() || !p.refNube() || (yo && foto.persona && foto.persona.uid && foto.persona.uid === yo.uid);
        p.hoja({
            titulo: cuando(foto.horaCelular),
            sub: (foto.persona && foto.persona.nombre ? foto.persona.nombre + " · " : "") + nota(foto.estado).texto,
            html: `<div class="pzFotoTicket"><img src="${p.esc(foto.foto)}" alt="Heladera de ${p.esc(foto.comercio)}"></div>${foto.nota ? `<p class="pzHojaSub">“${p.esc(foto.nota)}”</p>` : ""}`,
            botones: puedeBorrar ? [{ texto: "Borrar foto", clase: "pzBtnLinea", alTocar: () => { extras.borrar("heladeras", foto.id); setTimeout(dibujar, 0); } }] : []
        });
    }

    extras.escuchar("heladeras", () => {
        if (!document.getElementById("pantallaHeladera")?.classList.contains("oculto")) dibujar();
    });

    (window.accionesFichaComercioExtras = window.accionesFichaComercioExtras || []).push((comercio, crearBoton, cerrarFicha) => {
        if (comercio.archivado === true) return null;
        const cuantas = fotosDe(comercio.nombre).length;
        return crearBoton(p.ico("camara", 14) + " Exhibición" + (cuantas ? " (" + cuantas + ")" : ""), "secundario", () => { cerrarFicha(); abrir(comercio.nombre); });
    });

    window.heladerasVendeFrio = { abrir, fotosDe };
}());
