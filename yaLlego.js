// VendeFrío - "Ya llego" por WhatsApp (T72).
// En la próxima parada de Inicio y en la navegación: abre WhatsApp con el
// comercio y el mensaje escrito ("Llego en unos 5 minutos con tu pedido").
(function () {
    "use strict";

    function numeroWhatsapp(telefono) {
        let digitos = String(telefono || "").replace(/\D/g, "");
        if (digitos.length < 8) return "";
        if (!digitos.startsWith("54")) digitos = "549" + digitos.replace(/^0/, "").replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
        return digitos;
    }

    function mensaje(comercio, minutos) {
        const contacto = String(comercio && comercio.contacto || "").trim().split(/\s+/)[0];
        const persona = window.piezas?.persona?.();
        const quien = persona && persona.nombre ? String(persona.nombre).split(/\s+/)[0] : "";
        const distribuidora = window.distribuidoraVendeFrio?.nombreActual?.() || "";
        const presentacion = quien || distribuidora
            ? " Soy " + (quien || "") + (quien && distribuidora ? " de " : "") + (distribuidora || "") + "."
            : "";
        const cuando = Number(minutos) > 1 ? "Llego en unos " + Math.round(minutos) + " minutos" : "Ya estoy llegando";
        return "¡Hola" + (contacto ? " " + contacto : "") + "!" + presentacion + " " + cuando + " con tu pedido.";
    }

    // El enlace de WhatsApp con el mensaje, o "" si el comercio no tiene teléfono.
    function enlace(comercio, minutos) {
        const numero = numeroWhatsapp(comercio && comercio.telefono);
        return numero ? "https://wa.me/" + numero + "?text=" + encodeURIComponent(mensaje(comercio, minutos)) : "";
    }

    window.yaLlegoVendeFrio = { enlace, mensaje };
}());
