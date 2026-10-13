// VendeFrío - Configuración de las pruebas automáticas (W1)
// Se corren con "npm test" (ver WORKING_GUIDE.md): abre la app en Chromium,
// en tamaño de celular, una vez en modo claro y otra en modo oscuro.
const { defineConfig } = require("@playwright/test");

const PUERTO = 4173;
const celular = {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires"
};

module.exports = defineConfig({
    testDir: ".",
    testMatch: "*.prueba.js",
    globalSetup: require.resolve("./limpiar-capturas.js"),
    // Una prueba por vez: todas comparten los mismos emuladores.
    workers: 1,
    fullyParallel: false,
    timeout: 90000,
    expect: { timeout: 10000 },
    reporter: [["list"]],
    outputDir: "../test-results",
    use: {
        baseURL: `http://127.0.0.1:${PUERTO}`,
        // El service worker guarda copias de los archivos: en las pruebas se
        // apaga para que siempre se use el código del repo.
        serviceWorkers: "block",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
            : {}
    },
    projects: [
        { name: "claro", use: { ...celular, colorScheme: "light" } },
        { name: "oscuro", use: { ...celular, colorScheme: "dark" } }
    ],
    webServer: {
        command: "node servidor.js",
        url: `http://127.0.0.1:${PUERTO}`,
        reuseExistingServer: true,
        env: { PUERTO_PRUEBAS: String(PUERTO) }
    }
});
