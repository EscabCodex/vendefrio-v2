// VendeFrío - Recorridos en la nube, con los emuladores de Firebase. Las
// reglas de firestore.rules están activas en el emulador, así que cada paso
// pasa por ellas.
// 1. El principal: registrar la distribuidora, cargar un pedido, armarlo con
//    la checklist (el primer tilde lo pasa solo a "En preparación", T29b),
//    salir a repartir, entregarlo y cobrarlo.
// 2. Pasos más cortos (T29b): un pedido viejo en "Cargado en el vehículo" se
//    ve como "En reparto", vuelve un paso atrás a "Cargado" y se entrega
//    directo desde "Cargado".
// 3. "Salir a repartir" en tanda (T29c): elegir varios pedidos cargados,
//    "Marcar todos", confirmar con el resumen y, si otro celular canceló uno
//    mientras tanto, avisarlo y sacar los demás.
// 4. "Todos pueden hacer todo" y "Cobra" para aprobar (T29d), con el dueño y
//    un empleado en dos celulares: con la llave prendida el empleado sin
//    roles hace todos los pasos pero no cobra; elige "Cobranza", queda
//    pendiente, el dueño recibe el aviso y lo aprueba, y ahí cobra; con la
//    llave apagada vuelve a cada uno según sus permisos. Lo que la app no
//    deja, la nube tampoco (escrituras directas, saltándose la app).
const { test, expect, capturar, deslizar, prepararPagina } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, abrirConfiguracionEn, irAPedidos } = require("./recorridos");

test.use({ nube: true });

test("nube: cargar, armar, entregar y cobrar un pedido", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await capturar(page, "nube-01-inicio");

    // Pedidos: la lista empieza vacía y el botón flotante abre "Nuevo pedido".
    await cargarPedido(page, true);

    // Vuelve sola a la lista, en "Cargados".
    const tarjeta = page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText("Cargado");
    await capturar(page, "nube-03-pedidos-cargados");

    // Ficha del pedido (T29b): en "Cargado" ya es la checklist, sin "Empezar
    // a preparar" ni "Cargado en el vehículo", y se puede entregar deslizando.
    await tarjeta.click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha).toBeVisible();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Cargado");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cargado por" })).toContainText("Jere");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Total" })).toContainText("9.800");
    await expect(ficha.locator(".lineaChecklist")).toHaveCount(2);
    await expect(ficha).toContainText("Al tildar el primer producto, el pedido pasa a «En preparación».");
    await expect(ficha.getByRole("button", { name: "Salir a repartir" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Deslizá para marcar Entregado/ })).toBeVisible();
    await expect(ficha.getByRole("button", { name: "Empezar a preparar" })).toHaveCount(0);
    await expect(ficha.getByRole("button", { name: "Entregar en el mostrador" })).toHaveCount(0);
    await expect(ficha).not.toContainText("vehículo");
    await capturar(page, "nube-04-ficha-cargado");

    // Armar: el primer tilde pasa el pedido solo a "En preparación", a
    // nombre de quien tildó.
    await ficha.locator(".lineaChecklist", { hasText: "Helado 1 kg" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En preparación");
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("En preparación");
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("Jere");
    await ficha.locator(".lineaChecklist", { hasText: "Palito bombón" }).click();
    await expect(ficha).toContainText("2 de 2 listos");
    await expect(ficha.locator(".pasoSeguimiento", { hasText: "En preparación" })).toHaveCount(1);
    await capturar(page, "nube-05-checklist");

    // "Preparado" sigue igual, como paso opcional.
    await ficha.getByRole("button", { name: "Marcar preparado" }).click();
    await expect(page.getByRole("button", { name: /Deslizá para marcar Preparado/ })).toBeVisible();
    await capturar(page, "nube-06-resumen-preparado");
    await deslizar(page, "Deslizá para marcar Preparado");

    // Con Web Bluetooth (Android con Chrome) pregunta si imprimir el ticket.
    const ahoraNo = page.getByRole("button", { name: "Ahora no" });
    if (await ahoraNo.isVisible({ timeout: 3000 }).catch(() => false)) await ahoraNo.click();

    // Reparto: "Salir a repartir" lleva directo a "En reparto".
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Preparado");
    await expect(ficha.getByRole("button", { name: "Cargar en el vehículo" })).toHaveCount(0);
    await ficha.getByRole("button", { name: "Salir a repartir" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En reparto");
    await expect(page.getByRole("button", { name: /Deslizá para marcar Entregado/ })).toBeVisible();
    await capturar(page, "nube-07-en-reparto");

    // Entregar deslizando y cobrar en efectivo.
    await deslizar(page, "Deslizá para marcar Entregado");
    await expect(page.getByText("¿Cómo pagó?")).toBeVisible();
    await page.getByRole("button", { name: "Efectivo" }).click();
    await expect(page.locator("#montoCobroPedido")).toHaveValue(/9\.?800/);
    await capturar(page, "nube-08-como-pago");
    await page.getByRole("button", { name: "Guardar cobro" }).click();

    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cobro" }).first()).toContainText("Efectivo · $ 9.800");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cobrado por" })).toContainText("Jere");
    await expect(ficha).not.toContainText("vehículo");
    await capturar(page, "nube-09-entregado-y-cobrado");

    // Sin cambios pendientes de subir: todo llegó a la nube del emulador.
    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
});

test("nube: pedido viejo en el vehículo, volver atrás y entregar desde Cargado", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);

    const tarjeta = page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" });
    await expect(tarjeta).toBeVisible();

    // Como lo deja un celular con la versión vieja de la app: el pedido pasa
    // a "Cargado en el vehículo" (las reglas lo siguen aceptando).
    await page.evaluate(() => {
        const pedido = obtenerHistorial().find(item => item.comercio === "Almacén Don Pepe");
        window.nubeVendeFrio.agregarEstadoAlPedido(pedido.id, "enVehiculo", "");
    });

    // Se ve y se maneja como "En reparto", en la lista y en la ficha.
    await page.locator("#filtrosEtapaPedidos").getByRole("tab", { name: /En reparto/ }).click();
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.locator(".estadoSeguimiento")).toHaveText("En reparto");
    await expect(page.locator("#filtrosEtapaPedidos")).not.toContainText("vehículo");

    await tarjeta.click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En reparto");
    await expect(page.getByRole("button", { name: /Deslizá para marcar Entregado/ })).toBeVisible();
    // El historial no cambia: el paso viejo sigue en el seguimiento.
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("Cargado en el vehículo");
    await capturar(page, "nube-10-pedido-viejo-en-reparto");

    // Volver un paso atrás: vuelve a "Cargado", el paso que tenía antes.
    await ficha.getByRole("button", { name: "Volver un paso atrás" }).click();
    const modal = page.locator("#modalTextoPedido");
    await expect(modal).toContainText("El pedido pasa de «En reparto» a «Cargado»");
    await modal.locator("#campoTextoPedido").fill("Lo bajamos del vehículo");
    await modal.getByRole("button", { name: "Volver a Cargado" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Cargado");
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("Lo bajamos del vehículo");

    // Entregar directo desde "Cargado", deslizando, sin cobrar todavía.
    await capturar(page, "nube-11-entregar-desde-cargado");
    await deslizar(page, "Deslizá para marcar Entregado");
    await expect(page.getByText("¿Cómo pagó?")).toBeVisible();
    await page.getByRole("button", { name: "Todavía no pagó" }).click();
    await page.getByRole("button", { name: "Dejar pendiente" }).click();

    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Entregado");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Entregado por" })).toContainText("Jere");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cobro" }).first()).toContainText("Pendiente");
    await capturar(page, "nube-12-entregado-desde-cargado");

    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
});

test("nube: salir a repartir en tanda", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() =>
        agregarComercio({ nombre: "Kiosco Luna", direccion: "Belgrano 45", telefono: "" }) &&
        agregarComercio({ nombre: "Super Norte", direccion: "Mitre 900", telefono: "" })
    );
    for (const comercio of ["Almacén Don Pepe", "Kiosco Luna", "Super Norte"]) {
        await cargarPedido(page, false, comercio);
    }

    const tarjetas = page.locator(".tarjetaSeguimiento");
    const pie = page.locator(".pieTandaPedidos");
    await expect(tarjetas).toHaveCount(3);
    await expect(pie).toBeHidden();

    // "Elegir varios": las tarjetas se marcan en vez de abrir la ficha y
    // abajo aparece "Salir a repartir (N)" en lugar del botón flotante.
    await page.getByRole("button", { name: "Elegir varios" }).click();
    await expect(pie.getByRole("button", { name: "Salir a repartir (0)" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Nuevo pedido" })).toBeHidden();
    await page.getByRole("checkbox", { name: /Almacén Don Pepe/ }).click();
    await page.getByRole("checkbox", { name: /Kiosco Luna/ }).click();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
    await expect(page.locator(".fichaPedido")).toBeHidden();
    await capturar(page, "nube-13-elegir-varios");

    // "Cancelar" deja todo como estaba.
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(pie).toBeHidden();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(tarjetas).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Nuevo pedido" })).toBeVisible();

    // "Marcar todos" y confirmar con el resumen.
    await page.getByRole("button", { name: "Elegir varios" }).click();
    await page.getByRole("button", { name: "Marcar todos" }).click();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Desmarcar todos" })).toBeVisible();
    await pie.getByRole("button", { name: "Salir a repartir (3)" }).click();
    const confirmar = page.locator("#modalRepartoTanda");
    await expect(confirmar).toBeVisible();
    await expect(confirmar).toContainText("3 pedidos (9 unidades) pasan a «En reparto»");
    await expect(confirmar.locator("li")).toHaveCount(3);
    await capturar(page, "nube-14-confirmar-tanda");

    // Mientras tanto, otro (acá, el dueño desde la consola) cancela uno.
    await page.evaluate(() => {
        const pedido = obtenerHistorial().find(item => item.comercio === "Super Norte");
        window.nubeVendeFrio.cancelarPedido(pedido.id, "Ya no lo quiere");
    });
    await confirmar.getByRole("button", { name: "Salir a repartir (3)" }).click();

    const aviso = page.locator("#modalAviso");
    await expect(aviso).toContainText("Algunos pedidos no salieron");
    await expect(aviso).toContainText("Salieron 2 de 3 a reparto");
    await expect(aviso).toContainText("Super Norte (ahora está «Cancelado»)");
    await capturar(page, "nube-15-tanda-con-aviso");
    await aviso.getByRole("button", { name: "Entendido" }).click();

    // Cargados queda vacío y los dos salen en "En reparto".
    await expect(tarjetas).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Elegir varios" })).toBeHidden();
    await expect(pie).toBeHidden();
    await page.locator("#filtrosEtapaPedidos").getByRole("tab", { name: /En reparto/ }).click();
    await expect(tarjetas).toHaveCount(2);
    await expect(tarjetas.filter({ hasText: "Almacén Don Pepe" })).toBeVisible();
    await expect(tarjetas.filter({ hasText: "Kiosco Luna" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Elegir varios" })).toBeHidden();
    await capturar(page, "nube-16-en-reparto-tanda");

    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
});

// Escribe directo en la nube del emulador, sin pasar por la app (como lo
// haría alguien que se salta la app). Devuelve "ok" o el código del error.
async function escribirDirecto(page, accion, comercio = "Almacén Don Pepe") {
    return page.evaluate(async ({ accion, comercio }) => {
        const db = window.firebase.firestore();
        const guardado = JSON.parse(localStorage.getItem("vendefrio_empleado"));
        const ref = db.collection("distribuidoras").doc(guardado.distribuidora);
        const ficha = ref.collection("empleados").doc(guardado.idEmpleado);
        const yo = { idPersona: guardado.idEmpleado, nombre: "Maxi", uid: guardado.uid };
        const pedido = obtenerHistorial().find(item => item.comercio === comercio);
        const escrituras = {
            prenderLlave: () => ref.collection("config").doc("equipo").set({ todosPuedenTodo: true }),
            apagarLlave: () => ref.collection("config").doc("equipo").set({ todosPuedenTodo: false }),
            aprobarme: () => ficha.update({ rolesPendientes: [] }),
            cobranzaSinPendiente: () => ficha.update({ roles: ["cobranza"], rolesPendientes: [] }),
            cobrar: () => ref.collection("pedidos").doc(pedido.id).update({
                cobro: { forma: "efectivo", monto: 100, comprobante: null, persona: yo, horaCelular: Date.now() }
            }),
            salirARepartir: () => ref.collection("pedidos").doc(pedido.id).update({
                estado: "enReparto",
                ["estados.est_directo" + Date.now()]: { estado: "enReparto", persona: yo, horaCelular: Date.now(), nota: "" }
            })
        };
        try {
            await escrituras[accion]();
            return "ok";
        } catch (error) {
            return error.code || String(error);
        }
    }, { accion, comercio });
}

test("nube: todos pueden hacer todo y Cobra para aprobar", async ({ page, browser }, testInfo) => {
    await registrarDistribuidora(page, testInfo);

    // El dueño ve la llave prendida (así arranca) y genera un código.
    await abrirConfiguracionEn(page, "empleados");
    const llave = page.locator("#llaveTodosPuedenTodo");
    await expect(llave).toBeChecked();
    await expect(page.locator(".llaveEquipo")).toContainText("cualquiera del equipo hace cualquier paso");
    await capturar(page, "nube-17-llave-prendida");
    await page.getByRole("button", { name: "Generar código para un empleado nuevo" }).click();
    const codigo = (await page.locator("#empleadoCodigoGenerado strong").textContent()).trim();
    expect(codigo).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // Segundo celular: el empleado entra con el código, sin roles.
    const contexto = await browser.newContext({
        ...testInfo.project.use,
        baseURL: testInfo.project.use.baseURL,
        serviceWorkers: "block"
    });
    const empleado = await contexto.newPage();
    const erroresEmpleado = await prepararPagina(empleado, true);
    await empleado.goto("/");
    await empleado.getByRole("button", { name: /Empleado/ }).click();
    await empleado.locator("#inicioCodigo").fill(codigo);
    await empleado.locator("#inicioFormEmpleado").getByRole("button", { name: "Entrar" }).click();
    await expect(empleado.locator("#inicioNombreEmpleado")).toBeVisible({ timeout: 20000 });
    await empleado.locator("#inicioNombreEmpleado").fill("Maxi");
    await expect(empleado.locator("#inicioListaRoles .inicioRol", { hasText: "Cobranza" }))
        .toContainText("Con «Cobra»: lo aprueba tu encargado");
    await expect(empleado.locator("#inicioNotaCobra")).toBeVisible();
    await empleado.locator("#inicioFormDatosEmpleado").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(empleado.locator("#pantallaInicioSesion")).toBeHidden();

    // El dueño carga un pedido; el empleado, sin roles, lo arma, marca y
    // resuelve una incidencia, sale a repartir y lo entrega, pero no cobra.
    await irAPedidos(page);
    await cargarPedido(page, false);
    await irAPedidos(empleado);
    const tarjeta = empleado.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" });
    await tarjeta.click();
    const ficha = empleado.locator(".fichaPedido");
    await ficha.locator(".lineaChecklist", { hasText: "Helado 1 kg" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En preparación");
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("Maxi");

    await ficha.getByRole("button", { name: "Marcar incidencia" }).click();
    const modalTexto = empleado.locator("#modalTextoPedido");
    await expect(modalTexto).toContainText("hasta que alguien del equipo la resuelva");
    await modalTexto.locator("#campoTextoPedido").fill("Falta un helado en la cámara");
    await modalTexto.getByRole("button", { name: "Marcar incidencia" }).click();
    await ficha.getByRole("button", { name: "Resolver incidencia" }).click();
    await modalTexto.locator("#campoTextoPedido").fill("Apareció en la otra cámara");
    await modalTexto.getByRole("button", { name: "Resolver", exact: true }).click();
    await expect(ficha.getByRole("button", { name: "Resolver incidencia" })).toHaveCount(0);

    await ficha.getByRole("button", { name: "Salir a repartir" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En reparto");
    // Espera a que la nube confirme el paso (la ficha se redibuja una vez).
    await expect(ficha).not.toContainText("Pendiente de sincronizar");
    await expect(empleado.getByRole("button", { name: /Deslizá para marcar Entregado/ })).toBeVisible();
    await deslizar(empleado, "Deslizá para marcar Entregado");
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Entregado");
    await expect(empleado.getByText("¿Cómo pagó?")).toHaveCount(0);
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cobro" }).first()).toContainText("Pendiente");
    await expect(ficha.getByRole("button", { name: "Registrar cobro" })).toHaveCount(0);
    await capturar(empleado, "nube-18-empleado-entrega-sin-cobrar");

    // Saltándose la app, la nube tampoco lo deja cobrar, ni tocar la llave.
    expect(await escribirDirecto(empleado, "cobrar")).toBe("permission-denied");
    expect(await escribirDirecto(empleado, "apagarLlave")).toBe("permission-denied");
    expect(await escribirDirecto(empleado, "cobranzaSinPendiente")).toBe("permission-denied");
    await ficha.getByRole("button", { name: "Cerrar" }).click();

    // El empleado elige "Cobranza" en Cuenta: queda pendiente de aprobar.
    await abrirConfiguracionEn(empleado, "cuenta");
    await empleado.getByRole("button", { name: "Cambiar mi nombre o mis roles" }).click();
    await empleado.locator("#inicioListaRoles .inicioRol", { hasText: "Cobranza" }).click();
    await capturar(empleado, "nube-19-elegir-cobranza");
    await empleado.locator("#inicioFormDatosEmpleado").getByRole("button", { name: "Guardar y entrar" }).click();
    const aviso = empleado.locator("#modalAviso");
    await expect(aviso).toContainText("Rol pendiente de aprobar");
    await expect(aviso).toContainText("«Cobranza» tiene «Cobra»");
    await aviso.getByRole("button", { name: "Entendido" }).click();
    await expect(empleado.locator(".configDetalle")).toContainText("Cobranza (pendiente de aprobar)");
    await expect(empleado.locator("#misPermisos")).toContainText("Cobrar: todavía no. «Cobranza» está pendiente de aprobar");
    await capturar(empleado, "nube-20-cuenta-pendiente");

    // Mientras está pendiente, ni la app ni la nube lo dejan cobrar ni
    // aprobarse solo.
    expect(await escribirDirecto(empleado, "aprobarme")).toBe("permission-denied");
    expect(await escribirDirecto(empleado, "cobrar")).toBe("permission-denied");

    // Al dueño le llega el aviso; al tocarlo abre Empleados y lo aprueba.
    await irAPedidos(page);
    await page.locator("#pantallaPedido .campanaAvisos").click();
    const itemAviso = page.locator(".itemAviso[data-tipo=\"rolPendiente\"]");
    await expect(itemAviso).toContainText("Rol pendiente de aprobar");
    await expect(itemAviso).toContainText("Maxi");
    await itemAviso.click();
    const pendiente = page.locator(".empleadoRolPendiente");
    await expect(pendiente).toContainText("Cobranza");
    await expect(pendiente).toContainText("Pendiente de aprobar");
    await pendiente.scrollIntoViewIfNeeded();
    await capturar(page, "nube-21-aprobar-rol");
    await pendiente.getByRole("button", { name: "Aprobar" }).click();
    await expect(page.locator(".empleadoRolPendiente")).toHaveCount(0);

    // Aprobado, el empleado cobra el pedido que entregó.
    await expect(empleado.locator("#misPermisos")).toContainText("Cobrar: sí");
    await irAPedidos(empleado);
    await empleado.locator("#filtrosEtapaPedidos").getByRole("tab", { name: /A cobrar/ }).click();
    await tarjeta.click();
    await ficha.getByRole("button", { name: "Registrar cobro" }).click();
    await empleado.getByRole("button", { name: "Efectivo" }).click();
    await empleado.getByRole("button", { name: "Guardar cobro" }).click();
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cobrado por" })).toContainText("Maxi");
    await ficha.getByRole("button", { name: "Cerrar" }).click();

    // Con la llave apagada, el empleado (que solo tiene Cobranza) ya no ve
    // "Salir a repartir" ni puede hacerlo saltándose la app.
    await abrirConfiguracionEn(page, "empleados");
    await page.locator("#llaveTodosPuedenTodo").uncheck();
    await expect(page.locator("#textoLlaveEquipo")).toContainText("Apagada: cada uno según los permisos");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "nube-22-llave-apagada");
    await page.evaluate(() => agregarComercio({ nombre: "Kiosco Luna", direccion: "Belgrano 45", telefono: "" }));
    await irAPedidos(page);
    await cargarPedido(page, false, "Kiosco Luna");

    await irAPedidos(empleado);
    await empleado.locator("#filtrosEtapaPedidos").getByRole("tab", { name: /Cargados/ }).click();
    await empleado.locator(".tarjetaSeguimiento", { hasText: "Kiosco Luna" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Cargado");
    await expect(ficha.getByRole("button", { name: "Salir a repartir" })).toHaveCount(0);
    expect(await escribirDirecto(empleado, "salirARepartir", "Kiosco Luna")).toBe("permission-denied");
    expect(await escribirDirecto(empleado, "prenderLlave")).toBe("permission-denied");
    await ficha.getByRole("button", { name: "Cerrar" }).click();
    await abrirConfiguracionEn(empleado, "cuenta");
    await expect(empleado.locator("#misPermisos")).toContainText("Ninguno por ahora");
    await expect(empleado.locator("#misPermisos")).toContainText("Cobrar: sí");

    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
    await contexto.close();
    expect(erroresEmpleado, "La página del empleado tuvo errores de JavaScript").toEqual([]);
});
