// VendeFrío - Que se sienta como app propia y no como página de Chrome:
// mantener apretado no selecciona texto ni abre el menú del navegador, y
// donde se escribe se puede seguir copiando y pegando.
const { test, expect } = require("./ayudas");

test("app propia: sin menú de Chrome al mantener apretado, salvo donde se escribe", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();

    const resultado = await page.evaluate(() => {
        const menuBloqueado = elemento => {
            const evento = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
            elemento.dispatchEvent(evento);
            return evento.defaultPrevented;
        };
        const boton = document.querySelector(".bottom-nav button");
        const campo = document.querySelector("input:not([type='hidden'])");
        const estiloBody = getComputedStyle(document.body);
        return {
            botonBloqueado: menuBloqueado(boton),
            campoBloqueado: menuBloqueado(campo),
            seleccionBody: estiloBody.userSelect || estiloBody.webkitUserSelect,
            seleccionCampo: getComputedStyle(campo).userSelect || getComputedStyle(campo).webkitUserSelect,
            toque: getComputedStyle(document.documentElement).touchAction
        };
    });
    expect(resultado.botonBloqueado).toBe(true);
    expect(resultado.campoBloqueado).toBe(false);
    expect(resultado.seleccionBody).toBe("none");
    expect(resultado.seleccionCampo).not.toBe("none");
    expect(resultado.toque).toBe("manipulation");

    const manifiesto = await (await page.request.get("/manifest.json")).json();
    expect(manifiesto.display).toBe("standalone");
});
