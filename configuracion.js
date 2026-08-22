// VendeFrío - Configuración móvil
(function () {
    const CLAVE = "vendefrio_preferencias";
    const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (error) { return {}; } };
    const guardar = datos => localStorage.setItem(CLAVE, JSON.stringify(datos));

    function crearPantalla() {
        if (document.getElementById("pantallaConfiguracion")) return document.getElementById("pantallaConfiguracion");
        const pantalla = document.createElement("section");
        pantalla.id = "pantallaConfiguracion";
        pantalla.className = "oculto pantallaConfiguracion";
        pantalla.innerHTML = `<header><div class="logo">⚙️</div><div><h1>Configuración</h1><p>Personalizá VendeFrío</p></div></header><main class="container"><button type="button" class="configVolver">← Volver</button><section class="configGrupo"><h2>Apariencia</h2><label>Tema<select id="configTema"><option value="sistema">Usar tema del teléfono</option><option value="claro">Modo claro</option><option value="oscuro">Modo oscuro</option></select></label><label>Tamaño de texto<select id="configTexto"><option value="normal">Estándar</option><option value="grande">Grande</option></select></label><label>Espaciado<select id="configDensidad"><option value="compacto">Compacto</option><option value="comodo">Cómodo</option></select></label></section><section class="configGrupo"><h2>Datos y respaldo</h2><p id="configEstadoRespaldo">Protegé tus comercios, productos, pedidos y rutas.</p><div class="configAcciones"><button type="button" id="configExportar">⬇️ Exportar</button><button type="button" id="configImportar">⬆️ Importar</button></div><button type="button" id="configBorrar" class="configPeligro">Borrar todos los datos</button></section><section class="configGrupo"><h2>Preferencias de trabajo</h2><label>Mostrar primero<select id="configOrden"><option value="pendientes">Comercios pendientes</option><option value="frecuentes">Más visitados</option><option value="alfabetico">Orden alfabético</option></select></label></section><section class="configGrupo"><h2>Navegación</h2><p>Bicicleta · Vista inclinada · Seguimiento GPS</p><button type="button" id="configIrRutas">Abrir Rutas</button></section><section class="configGrupo configInfo"><h2>Seguridad y aplicación</h2><p>VendeFrío Lite</p><p>Los datos se guardan en este dispositivo.</p><button type="button" id="configRestablecer">Restablecer preferencias visuales</button></section></main>`;
        document.body.insertBefore(pantalla, document.querySelector("nav.bottom-nav"));
        return pantalla;
    }

    function aplicarPreferencias() {
        const datos = leer();
        document.documentElement.dataset.tema = datos.tema || "sistema";
        document.documentElement.dataset.texto = datos.texto || "normal";
        document.documentElement.dataset.densidad = datos.densidad || "compacto";
    }

    function abrir() {
        const pantalla = crearPantalla();
        document.querySelectorAll("body > section").forEach(item => item.classList.add("oculto"));
        pantalla.classList.remove("oculto");
        const datos = leer();
        ["tema", "texto", "densidad", "orden"].forEach(nombre => { const control = document.getElementById("config" + nombre[0].toUpperCase() + nombre.slice(1)); if (control) control.value = datos[nombre] || (nombre === "tema" ? "sistema" : nombre === "densidad" ? "compacto" : nombre === "orden" ? "pendientes" : "normal"); });
    }

    function conectar() {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "menuBtn botonConfiguracionInicio";
        boton.textContent = "⚙️ Configuración";
        boton.addEventListener("click", abrir);
        const accesos = document.querySelector("#pantallaMenu .container > div[style*='grid-template-columns']");
        if (accesos && !document.querySelector(".botonConfiguracionInicio")) accesos.appendChild(boton);

        document.addEventListener("click", event => {
            const id = event.target.id;
            if (id === "configTema" || id === "configTexto" || id === "configDensidad" || id === "configOrden") {
                const datos = leer(); datos[id.replace("config", "").toLowerCase()] = event.target.value; guardar(datos); aplicarPreferencias();
            }
            if (event.target.closest(".configVolver")) { document.getElementById("pantallaConfiguracion")?.classList.add("oculto"); mostrarPantalla("menu"); }
            if (id === "configIrRutas") { document.getElementById("pantallaConfiguracion")?.classList.add("oculto"); mostrarPantalla("rutas"); }
            if (id === "configRestablecer") { localStorage.removeItem(CLAVE); aplicarPreferencias(); abrir(); }
            if (id === "configExportar") document.getElementById("exportarRespaldo")?.click();
            if (id === "configImportar") document.getElementById("importarRespaldo")?.click();
            if (id === "configBorrar") document.getElementById("borrarTodosDatos")?.click();
        });
    }

    aplicarPreferencias();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", conectar); else conectar();
}());
