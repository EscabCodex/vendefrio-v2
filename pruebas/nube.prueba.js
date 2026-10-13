// VendeFrío - Recorridos en la nube, con los emuladores de Firebase. Las
// reglas de firestore.rules están activas en el emulador, así que cada paso
// pasa por ellas.
// 1. Registrar la distribuidora, cargar un pedido, armarlo con la checklist
//    (el primer tilde lo pasa solo a "En preparación"), salir a repartir,
//    entregarlo y cobrarlo.
// 2. Pasos más cortos (T29b): entregar directo desde "Cargado", salir a
//    repartir desde "Cargado" y volver atrás, el primer tilde de un empleado
//    sin permisos (en otro celular) y un pedido viejo en "Cargado en el
//    vehículo".
const { test, expect, capturar, deslizar } = require("./ayudas");

test.use({ nube: true });

// Registrarse: cuenta y distribuidora nuevas (en el emulador), con un
// comercio y dos productos con precio, guardados con las mismas funciones
// que usa la app (van a la nube del emulador).
async function registrarDistribuidora(page, testInfo, comercios) {
    await page.goto("/");

    // Registrarse: cuenta y distribuidora nuevas (en el emulador).
    await page.getByRole("button", { name: /Distribuidora/ }).click();
    await page.getByRole("button", { name: /Registrarse/ }).click();
    await page.locator("#inicioRegistroNombre").fill("Distribuidora Prueba");
    await page.locator("#inicioRegistroEmail").fill(`dueno-${testInfo.project.name}-${Date.now()}@prueba.com`);
    await page.locator("#inicioRegistroContrasena").fill("clave-de-prueba");
    await page.locator("#inicioRegistroRepetir").fill("clave-de-prueba");
    await page.getByRole("button", { name: "Crear cuenta y distribuidora" }).click();

    // "Tu nombre" (se pide una sola vez al dueño).
    await expect(page.locator("#inicioNombreDueno")).toBeVisible({ timeout: 20000 });
    await page.locator("#inicioNombreDueno").fill("Jere");
    await page.locator("#inicioFormDatosDueno").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await expect(page.locator("#dashNombreDistribuidora")).toHaveText("Distribuidora Prueba");

    const guardado = await page.evaluate(lista =>
        lista.every(comercio => agregarComercio(comercio)) &&
        agregarMarca("Frío Sur") &&
        agregarProducto("Frío Sur", { nombre: "Helado 1 kg", precio: 4500 }) &&
        agregarProducto("Frío Sur", { nombre: "Palito bombón", precio: 800 }),
    comercios);
    expect(guardado).toBeTruthy();
}

// Carga un pedido de 2 helados y 1 palito (3 unidades, $ 9.800). Si
// "capturaFormulario" tiene un nombre, saca la captura del formulario.
async function cargarPedido(page, comercio, capturaFormulario) {
    await page.locator(".bottom-nav").getByRole("button", { name: "Pedido" }).click();
    await expect(page.locator("#vistaPedidos")).toBeVisible();
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await page.locator("#cliente").fill(comercio);
    await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    const palito = page.locator(".listaProdutos .fila", { hasText: "Palito bombón" });
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await palito.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("3");
    if (capturaFormulario) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await capturar(page, capturaFormulario);
    }

    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    await generado.click({ position: { x: 10, y: 10 } });
    await expect(generado).toBeHidden();

    // Vuelve sola a la lista, en "Cargados".
    const tarjeta = page.locator(".tarjetaSeguimiento", { hasText: comercio });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText("Cargado");
    return tarjeta;
}

// Muestra en la lista "Pedidos" la etapa con ese nombre.
async function verEtapa(page, nombre) {
    await page.locator("#filtrosEtapaPedidos .filtroEtapa", { hasText: nombre }).click();
}

async function cerrarFicha(page) {
    await page.locator("#modalFichaPedido").getByRole("button", { name: "Cerrar" }).click();
    await expect(page.locator(".fichaPedido")).toBeHidden();
}

// Con Web Bluetooth (Android con Chrome) pregunta si imprimir el ticket.
async function noImprimir(page) {
    const ahoraNo = page.getByRole("button", { name: "Ahora no" });
    if (await ahoraNo.isVisible({ timeout: 3000 }).catch(() => false)) await ahoraNo.click();
}

test("nube: cargar, armar, entregar y cobrar un pedido", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo, [
        { nombre: "Almacén Don Pepe", direccion: "San Martín 123", telefono: "11 5555-1234" }
    ]);
    await capturar(page, "nube-01-inicio");

    // Pedidos: la lista empieza vacía y el botón flotante abre "Nuevo pedido".
    const tarjeta = await cargarPedido(page, "Almacén Don Pepe", "nube-02-nuevo-pedido");
    await capturar(page, "nube-03-pedidos-cargados");

    // Ficha del pedido (T29b): la checklist ya se ve en "Cargado", con el
    // total con los precios del catálogo. No hay "Empezar a preparar":
    // se puede salir a repartir o entregar directo.
    await tarjeta.click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha).toBeVisible();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Cargado");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cargado por" })).toContainText("Jere");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Total" })).toContainText("9.800");
    await expect(ficha.locator(".lineaChecklist")).toHaveCount(2);
    await expect(ficha.getByRole("button", { name: "Empezar a preparar" })).toHaveCount(0);
    await expect(ficha.getByRole("button", { name: "Salir a repartir" })).toBeVisible();
    await expect(ficha.getByRole("button", { name: /Deslizá para marcar Entregado/ })).toBeVisible();
    await capturar(page, "nube-04-ficha-cargado");

    // Armar: el primer tilde pasa el pedido solo a "En preparación", a
    // nombre de quien tildó.
    await ficha.locator(".lineaChecklist", { hasText: "Helado 1 kg" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En preparación");
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("En preparación");
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("Jere");
    await ficha.locator(".lineaChecklist", { hasText: "Palito bombón" }).click();
    await expect(ficha).toContainText("2 de 2 listos");
    await capturar(page, "nube-05-checklist");

    await ficha.getByRole("button", { name: "Marcar preparado" }).click();
    await expect(page.getByRole("button", { name: /Deslizá para marcar Preparado/ })).toBeVisible();
    await capturar(page, "nube-06-resumen-preparado");
    await deslizar(page, "Deslizá para marcar Preparado");
    await noImprimir(page);

    // Reparto (T29b): "Salir a repartir" lleva directo a "En reparto", sin
    // "Cargado en el vehículo".
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Preparado");
    await expect(ficha.getByRole("button", { name: "Cargar en el vehículo" })).toHaveCount(0);
    await ficha.getByRole("button", { name: "Salir a repartir" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En reparto");
    await expect(page.getByRole("button", { name: /Deslizá para marcar Entregado/ })).toBeVisible();
    await expect(ficha).not.toContainText("vehículo");
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
    await capturar(page, "nube-09-entregado-y-cobrado");

    // Sin cambios pendientes de subir: todo llegó a la nube del emulador.
    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
});

test("nube: pasos más cortos (entregar directo, salir a repartir, tilde de un empleado)", async ({ page, otroCelular }, testInfo) => {
    await registrarDistribuidora(page, testInfo, [
        { nombre: "Kiosco La Esquina", direccion: "Belgrano 450", telefono: "11 4444-0001" },
        { nombre: "Super Norte", direccion: "Mitre 900", telefono: "11 4444-0002" },
        { nombre: "Almacén El Sol", direccion: "Rivadavia 77", telefono: "11 4444-0003" }
    ]);
    const ficha = page.locator(".fichaPedido");

    // 1. Entregar directo desde "Cargado", deslizando (sin pasos del medio).
    const kiosco = await cargarPedido(page, "Kiosco La Esquina");
    await kiosco.click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Cargado");
    await expect(ficha.getByRole("button", { name: "Entregar en el mostrador" })).toHaveCount(0);
    await deslizar(page, "Deslizá para marcar Entregado");
    await expect(page.getByText("¿Cómo pagó?")).toBeVisible();
    await page.getByRole("button", { name: "Todavía no pagó" }).click();
    await page.getByRole("button", { name: "Dejar pendiente" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Entregado");
    await expect(ficha.locator(".pasoSeguimiento")).toHaveCount(2);
    await capturar(page, "nube-10-entregado-desde-cargado");
    await cerrarFicha(page);

    // 2. "Salir a repartir" desde "Cargado" y volver un paso atrás: vuelve a
    //    "Cargado" (el paso del que salió), con motivo.
    const superNorte = await cargarPedido(page, "Super Norte");
    await superNorte.click();
    await ficha.getByRole("button", { name: "Salir a repartir" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En reparto");
    await ficha.getByRole("button", { name: "Volver un paso atrás" }).click();
    const motivo = page.locator("#modalTextoPedido");
    await expect(motivo).toContainText("pasa de «En reparto» a «Cargado»");
    await page.locator("#campoTextoPedido").fill("Salió sin armar");
    await capturar(page, "nube-11-volver-a-cargado");
    await motivo.getByRole("button", { name: "Volver a Cargado" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Cargado");
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("Salió sin armar");
    await cerrarFicha(page);

    // 3. Otro celular: un empleado sin roles (sin "Prepara pedidos") tilda
    //    el primer producto y el pedido pasa solo a "En preparación", a su
    //    nombre. Las reglas lo aceptan y el dueño lo ve en su celular.
    const { codigo } = await page.evaluate(() => window.empleadosVendeFrio.generarCodigo(null));
    await otroCelular.goto("/");
    await otroCelular.getByRole("button", { name: /Empleado/ }).click();
    await otroCelular.locator("#inicioCodigo").fill(codigo);
    await otroCelular.locator("#inicioFormEmpleado").getByRole("button", { name: "Entrar" }).click();
    await expect(otroCelular.locator("#inicioNombreEmpleado")).toBeVisible({ timeout: 20000 });
    await otroCelular.locator("#inicioNombreEmpleado").fill("Maxi");
    await otroCelular.locator("#inicioFormDatosEmpleado").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(otroCelular.locator("#pantallaInicioSesion")).toBeHidden();

    await otroCelular.locator(".bottom-nav").getByRole("button", { name: "Pedido" }).click();
    const superDelEmpleado = otroCelular.locator(".tarjetaSeguimiento", { hasText: "Super Norte" });
    await superDelEmpleado.click();
    const fichaEmpleado = otroCelular.locator(".fichaPedido");
    await expect(fichaEmpleado.locator(".lineaChecklist")).toHaveCount(2);
    // Sin "Reparte" no sale a repartir; entregar lo puede cualquiera.
    await expect(fichaEmpleado.getByRole("button", { name: "Salir a repartir" })).toHaveCount(0);
    await expect(fichaEmpleado.getByRole("button", { name: /Deslizá para marcar Entregado/ })).toBeVisible();
    await fichaEmpleado.locator(".lineaChecklist", { hasText: "Helado 1 kg" }).click();
    await expect(fichaEmpleado.locator(".etiquetasFichaPedido")).toContainText("En preparación");
    await expect(fichaEmpleado.locator(".pasoSeguimiento.actual")).toContainText("Maxi");
    await capturar(otroCelular, "nube-12-empleado-tilda");

    await verEtapa(page, "En preparación");
    const superDelDueno = page.locator(".tarjetaSeguimiento", { hasText: "Super Norte" });
    await expect(superDelDueno).toContainText("En preparación");
    await expect(superDelDueno).toContainText("Checklist: 1 de 2 listos");
    await capturar(page, "nube-13-dueno-ve-en-preparacion");
    await expect(otroCelular.getByText("La nube no guardó un cambio")).toHaveCount(0);

    // 4. Un pedido viejo en "Cargado en el vehículo" (de la versión de
    //    antes): se ve y se entrega como "En reparto", y el seguimiento
    //    viejo no cambia.
    await verEtapa(page, "Cargados");
    const sol = await cargarPedido(page, "Almacén El Sol");
    const idSol = await sol.getAttribute("data-id");
    await page.evaluate(async id => {
        const usuario = firebase.auth().currentUser;
        await firebase.firestore().collection("distribuidoras").doc(usuario.uid).collection("pedidos").doc(id).update({
            "estados.estviejo1": {
                estado: "enVehiculo",
                persona: { idPersona: "dueno", nombre: "Jere", uid: usuario.uid },
                horaCelular: Date.now(),
                nota: ""
            },
            estado: "enVehiculo"
        });
    }, idSol);
    await verEtapa(page, "En reparto");
    const solEnReparto = page.locator(".tarjetaSeguimiento", { hasText: "Almacén El Sol" });
    await expect(solEnReparto).toContainText("En reparto");
    await solEnReparto.click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En reparto");
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("Cargado en el vehículo");
    await capturar(page, "nube-14-pedido-viejo-en-reparto");
    await deslizar(page, "Deslizá para marcar Entregado");
    await expect(page.getByText("¿Cómo pagó?")).toBeVisible();
    await page.getByRole("button", { name: "Efectivo" }).click();
    await page.getByRole("button", { name: "Guardar cobro" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Entregado");

    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
    await expect(otroCelular.getByText("Pendiente de sincronizar")).toHaveCount(0);
});
