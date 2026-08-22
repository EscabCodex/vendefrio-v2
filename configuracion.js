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
        pantalla.innerHTML = `<header><div class="logo">⚙️</div><div><h1>Configuración</h1><p>Personalizá VendeFrío</p></div></header><main class="container"><button type="button" class="configVolver">← Volver</button><section class="configGrupo"><h2>Apariencia</h2><label>Tema<select id="configTema"><option value="sistema">Usar tema del teléfono</option><option value="claro">Modo claro</option><option value="oscuro">Modo oscuro</option></select></label><label>Tamaño de texto<select id="configTexto"><option value="normal">Estándar</option><option value="grande">Grande</option></select></label><label>Espaciado<select id="configDensidad"><option value="compacto">Compacto</option><option value="comodo">Cómodo</option></select></label></section><section class="configGrupo"><h2>Datos y respaldo</h2><p id="configEstadoRespaldo">Protegé tus comercios, productos, pedidos y rutas.</p><div class="configAcciones"><button type="button" id="configExportar">⬇️ Exportar</button><button type="button" id="configImportar">⬆️ Importar</button></div><label class="configSwitch"><input type="checkbox" id="configAutoRespaldo"><span>Respaldo automático</span></label><label class="configSwitch"><input type="checkbox" id="configRecordatorio"><span>Recordarme hacer un respaldo</span></label><button type="button" id="configBorrar" class="configPeligro">Borrar todos los datos</button></section><section class="configGrupo"><h2>Preferencias de trabajo</h2><label>Mostrar primero<select id="configOrden"><option value="pendientes">Comercios pendientes</option><option value="frecuentes">Más visitados</option><option value="alfabetico">Orden alfabético</option></select></label><label>Comercio predeterminado<select id="configComercio"><option value="">Elegir al hacer pedido</option></select></label><label>Orden de productos<select id="configOrdenProductos"><option value="marca">Por marca</option><option value="alfabetico">Alfabético</option><option value="frecuencia">Más pedidos</option></select></label></section><section class="configGrupo"><h2>Navegación</h2><label>Nivel de zoom<select id="configZoom"><option value="15">Amplio</option><option value="17">Normal</option><option value="18">Cercano</option></select></label><label class="configSwitch"><input type="checkbox" id="configSeguimiento"><span>Seguimiento automático</span></label><label class="configSwitch"><input type="checkbox" id="configInstrucciones"><span>Mostrar instrucciones</span></label><p>Bicicleta · Vista inclinada</p><button type="button" id="configIrRutas">Abrir Rutas</button></section><section class="configGrupo configInfo"><h2>Seguridad y aplicación</h2><p>VendeFrío Lite</p><p>Los datos se guardan en este dispositivo.</p><button type="button" id="configRestablecer">Restablecer preferencias visuales</button></section></main>`;
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
        const valores = { tema: "sistema", texto: "normal", densidad: "compacto", orden: "pendientes", ordenProductos: "marca", zoom: "17" };
        Object.entries(valores).forEach(([nombre, valorInicial]) => { const control = document.getElementById("config" + nombre[0].toUpperCase() + nombre.slice(1)); if (control) control.value = datos[nombre] || valorInicial; });
        const comercios = typeof obtenerComercios === "function" ? obtenerComercios() : [];
        const comercio = document.getElementById("configComercio");
        if (comercio) { comercio.innerHTML = '<option value="">Elegir al hacer pedido</option>'; comercios.sort((a,b) => a.nombre.localeCompare(b.nombre, "es")).forEach(item => { const opcion = document.createElement("option"); opcion.value = item.nombre; opcion.textContent = item.nombre; comercio.appendChild(opcion); }); comercio.value = datos.comercio || ""; }
        ["autoRespaldo", "recordatorio", "seguimiento", "instrucciones"].forEach(nombre => { const control = document.getElementById("config" + nombre[0].toUpperCase() + nombre.slice(1)); if (control) control.checked = datos[nombre] === true; });
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
            const controles = { configTema: "tema", configTexto: "texto", configDensidad: "densidad", configOrden: "orden", configOrdenProductos: "ordenProductos", configZoom: "zoom", configComercio: "comercio", configAutoRespaldo: "autoRespaldo", configRecordatorio: "recordatorio", configSeguimiento: "seguimiento", configInstrucciones: "instrucciones" };
            if (controles[id]) {
                const datos = leer(); datos[controles[id]] = event.target.type === "checkbox" ? event.target.checked : event.target.value; guardar(datos); aplicarPreferencias();
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
