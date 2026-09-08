/* ============================================================
   VendeFrío — Librería de íconos propios (línea, estilo operativo)
   Reemplaza los emojis del sistema por SVG consistentes en toda la app.
   Uso: icono("paquete", 18)  ->  string HTML con el <svg> listo para insertar.
============================================================ */
(function () {
  const PATHS = {
    paquete: '<path d="M12 2.6 3.6 6.8v10.4L12 21.4l8.4-4.2V6.8z"/><path d="M3.6 6.8 12 11l8.4-4.2"/><path d="M12 11v10.4"/>',
    ubicacion: '<path d="M12 21.5s7-6.6 7-12A7 7 0 0 0 5 9.5c0 5.4 7 12 7 12Z"/><circle cx="12" cy="9.3" r="2.4"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    alarma: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.3V13l2.6 1.6"/><path d="M5.2 4.8 3 7M18.8 4.8 21 7"/>',
    documento: '<path d="M6.3 3.5h8.3l5.1 5.1v11.9a1.2 1.2 0 0 1-1.2 1.2H6.3a1.2 1.2 0 0 1-1.2-1.2V4.7a1.2 1.2 0 0 1 1.2-1.2Z"/><path d="M14.4 3.5v4.3c0 .66.54 1.2 1.2 1.2h4.3"/><path d="M8.5 13h7M8.5 16.6h7"/>',
    recibo: '<path d="M6 3v18l2.3-1.6L10.5 21l2.2-1.6L15 21l2.3-1.6L19.5 21V3H6Z"/><path d="M9 8h6M9 11.3h6M9 14.6h4"/>',
    mapa: '<path d="M3.5 19.3 9 17l6 2.2 5.5-2.2V4.7L15 7 9 4.7l-5.5 2.3z"/><path d="M9 4.7v14.6M15 7v14.6"/>',
    grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    historial: '<path d="M2.6 12a9.4 9.4 0 1 0 3.1-7"/><path d="M2.6 3.6v4.7h4.7"/><path d="M12 7.5v4.9l3.3 2.2"/>',
    engranaje: '<circle cx="12" cy="12" r="3.1"/><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.5z"/>',
    etiqueta: '<path d="M20.4 13.2 12.8 20.8a1.7 1.7 0 0 1-2.4 0l-7.2-7.2a1.7 1.7 0 0 1 0-2.4L10.8 3.6H18a2.4 2.4 0 0 1 2.4 2.4z"/><circle cx="15.3" cy="8.7" r="1.4"/>',
    bolsa: '<path d="M6.5 8h11l1 12.5a1.4 1.4 0 0 1-1.4 1.5H6.9a1.4 1.4 0 0 1-1.4-1.5z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    rayo: '<path d="M12.8 2.6 4.5 13.8h5.7l-1.2 7.6 8.5-11.6h-5.9z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    telefono: '<path d="M6.6 3.6h3l1.3 4.4-2.2 1.7a13.2 13.2 0 0 0 5.6 5.6l1.7-2.2 4.4 1.3v3a1.6 1.6 0 0 1-1.7 1.6A16.6 16.6 0 0 1 4.9 5.4a1.6 1.6 0 0 1 1.7-1.8Z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M7.8 12.3l2.7 2.7 5.7-5.7"/>',
    puntoRojo: '<circle cx="12" cy="12" r="6"/>',
    lapiz: '<path d="M3.6 20.4h4.2l11-11a2.2 2.2 0 0 0 0-3.1l-1.3-1.3a2.2 2.2 0 0 0-3.1 0l-11 11z"/><path d="M13.2 6.3 17.7 10.8"/>',
    tacho: '<path d="M4.5 7.2h15"/><path d="M8.7 7.2V5a1.2 1.2 0 0 1 1.2-1.2h4.2A1.2 1.2 0 0 1 15.3 5v2.2"/><path d="M6.6 7.2 7.7 20.4a1.1 1.1 0 0 0 1.1 1h6.4a1.1 1.1 0 0 0 1.1-1l1.1-13.2"/><path d="M9.8 11v6.4M14.2 11v6.4"/>',
    navegar: '<path d="M3 11 20.5 3 12.5 20.5 10.3 13.2z"/><path d="M10.3 13.2 3 11"/>',
    buscar: '<circle cx="10.5" cy="10.5" r="6.8"/><path d="M20 20l-4.3-4.3"/>',
    persona: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    maletin: '<rect x="3" y="7.5" width="18" height="12" rx="1.8"/><path d="M8.5 7.5V5.8A1.8 1.8 0 0 1 10.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8V7.5"/><path d="M3 12.5h18"/>',
    escudo: '<path d="M12 3.5 19.5 6.5V12c0 5-3.2 7.7-7.5 8.5C7.7 19.7 4.5 17 4.5 12V6.5Z"/><path d="M9 12l2.2 2.2L15.5 9.6"/>',
    texto: '<path d="M6 6h12M9 6v12M9 18h6"/>',
    espaciado: '<path d="M4 4v16M20 4v16"/><path d="M4 12h16"/>',
    paleta: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.6-.7 1.6-1.5 0-.4-.15-.7-.4-1a1.6 1.6 0 0 1 1.2-2.7h1.6A3.5 3.5 0 0 0 19.5 12 8.5 8.5 0 0 0 12 3.5Z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.3" cy="7.3" r="1.1"/><circle cx="14.7" cy="7.3" r="1.1"/><circle cx="17" cy="11" r="1.1"/>',
    refrescar: '<path d="M4 10a8 8 0 0 1 14.5-4.5M20 14a8 8 0 0 1-14.5 4.5"/><path d="M18.5 3v3.5H15M5.5 21v-3.5H9"/>',
    bicicleta: '<circle cx="6" cy="17" r="3.2"/><circle cx="18" cy="17" r="3.2"/><path d="M6 17 10 8h4l4 9M9 17h9M10 8H8"/>',
    disquete: '<path d="M5 3.5h11.5L19 6v14.5H5Z"/><path d="M8 3.5v5h7v-5M8 14h8v6.5H8Z"/>',
    guardarNube: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-1 7.9"/><path d="M12 11v8m0 0-3-3m3 3 3-3"/>',
    restaurarNube: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-1 7.9"/><path d="M12 19v-8m0 0-3 3m3-3 3 3"/>',
    herramientas: '<path d="M14.7 6.3a3.6 3.6 0 0 0-5 4.3L4.5 15.8a1.8 1.8 0 0 0 2.5 2.5l5.2-5.2a3.6 3.6 0 0 0 4.3-5l-2 2-1.8-.5-.5-1.8Z"/>',
    tienda: '<path d="M3.5 9.3V5.8a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v3.5"/><path d="M3.5 9.3a2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0"/><path d="M4.6 9.3v10a1 1 0 0 0 1 1h3.4v-6.4h6v6.4h3.4a1 1 0 0 0 1-1v-10"/>',
    auto: '<path d="M4 16.5V12l2-5h12l2 5v4.5"/><path d="M4 16.5h16M6.5 16.5v2.2M17.5 16.5v2.2"/><circle cx="7.5" cy="16.5" r="1.3"/><circle cx="16.5" cy="16.5" r="1.3"/>',
    brujula: '<circle cx="12" cy="12" r="9"/><path d="m15 9-4.5 1.5L9 15l4.5-1.5z"/>',
    chevArriba: '<path d="M5 15l7-7 7 7"/>',
    chevAbajo: '<path d="M5 9l7 7 7-7"/>',
    flechaDerecha: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    cerrarX: '<path d="M6 6l12 12M18 6L6 18"/>',
    mas: '<path d="M12 5v14M5 12h14"/>'
  };

  window.icono = function (nombre, tam, color) {
    const tamano = tam || 18;
    const trazo = PATHS[nombre];
    if (!trazo) return "";
    return '<svg viewBox="0 0 24 24" width="' + tamano + '" height="' + tamano +
      '" fill="none" stroke="' + (color || "currentColor") +
      '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;flex-shrink:0;">' +
      trazo + '</svg>';
  };
})();
