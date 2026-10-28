// VendeFrío - Completar los datos del comercio desde cualquier pantalla (T180).
// Donde falta un dato (teléfono, dirección, horario...) va un botón
// «Agregar ...» que abre la bandeja de datos del comercio en ese dato, sin
// salir de la pantalla. Así la ficha se va llenando de a poco.
(function () {
    "use strict";

    const CAMPOS = {
        telefono: { icono: "telefono", texto: "Agregar teléfono", corto: "Agregar tel." },
        direccion: { icono: "ubicacion", texto: "Agregar dirección", corto: "Dirección" },
        horario: { icono: "reloj", texto: "Agregar horario", corto: "Horario" },
        contacto: { icono: "persona", texto: "Agregar contacto", corto: "Contacto" }
    };

    // Abre la bandeja única de datos del comercio en ese dato. Si todavía no
    // está, abre la ficha del comercio, que tiene para editarlo.
    function abrir(nombre, campo) {
        if (typeof window.abrirDatosComercio === "function") return window.abrirDatosComercio(nombre, campo);
        if (typeof window.abrirFichaComercio === "function") window.abrirFichaComercio(nombre);
    }

    // Píldora «+ Agregar teléfono» para poner en una línea de texto.
    function boton(nombre, campo, opciones = {}) {
        const dato = CAMPOS[campo];
        const el = document.createElement("button");
        el.type = "button";
        el.className = "agregarDato" + (opciones.clase ? " " + opciones.clase : "");
        el.dataset.agregarDato = campo;
        el.innerHTML = window.icono("mas", 16) + "<span></span>";
        el.querySelector("span").textContent = opciones.texto || dato.texto;
        el.addEventListener("click", evento => {
            evento.stopPropagation();
            if (typeof opciones.antes === "function") opciones.antes();
            abrir(nombre, campo);
        });
        return el;
    }

    // Lo mismo en texto, para las listas que se arman con innerHTML: el clic
    // lo atiende el escuchador de abajo.
    function html(nombre, campo, texto) {
        const dato = CAMPOS[campo];
        const esc = window.piezas ? window.piezas.esc : String;
        return `<button type="button" class="agregarDato" data-agregar-dato="${campo}" data-comercio="${esc(nombre)}">${window.icono("mas", 16)}<span>${esc(texto || dato.texto)}</span></button>`;
    }

    document.addEventListener("click", evento => {
        const el = evento.target.closest("[data-agregar-dato][data-comercio]");
        if (!el) return;
        evento.preventDefault();
        evento.stopPropagation();
        if (el.closest(".pzHoja") && window.piezas && window.piezas.cerrar) window.piezas.cerrar();
        abrir(el.dataset.comercio, el.dataset.agregarDato);
    }, true);

    window.agregarDatoVendeFrio = { abrir, boton, html, CAMPOS };
}());
