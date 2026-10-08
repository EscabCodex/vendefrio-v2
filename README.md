# VendeFrío

Plataforma móvil (PWA) para distribuidoras que venden y reparten productos a almacenes, kioscos y supermercados. El pedido se carga una sola vez, desde el celular, y acompaña toda la operación: venta, preparación, reparto y entrega.

- **Repositorio:** `EscabCodex/vendefrio-v2` (rama `main`, fuente de verdad)
- **Pruebas:** https://vendefrio-v2.vercel.app/
- **Tecnología:** HTML, CSS y JavaScript puro, PWA, datos en `localStorage` (por ahora)
- **Objetivo actual:** llegar a una versión 1.0 profesional, usable en el trabajo real durante meses

## Si sos una IA que acaba de llegar

1. Leé primero `WORKING_GUIDE.md`: dice quién es el dueño del producto, **cómo hablarle** (pasos numerados, nivel de principiante) y cómo se trabaja.
2. Después leé `PROJECT_STATE.md` para saber cómo está el código hoy.
3. Leé `PRODUCT.md` y `ORDER_FLOW.md` antes de proponer o tocar funciones de pedidos, y `ROADMAP.md` para saber qué sigue.

## Mapa de documentos

Cada archivo tiene un solo trabajo. Si algo cambia, se actualiza donde corresponde y en ningún otro lado.

| Archivo | Para qué sirve | Cuándo leerlo |
|---|---|---|
| `README.md` | Portada y mapa | Siempre, primero |
| `WORKING_GUIDE.md` | Cómo trabajamos: perfil del dueño, estilo de respuesta, roles, reglas, chats, Proyecto de Claude y límite de uso | Antes de responder cualquier cosa |
| `PRODUCT.md` | Visión, usuarios, propuesta de valor y alcance de la 1.0 | Antes de proponer o decidir funciones |
| `ORDER_FLOW.md` | Cómo vive un pedido: estados, checklist, faltantes, entrega y trabajo sin conexión | Antes de tocar pedidos |
| `ROADMAP.md` | Etapas, tareas y decisiones abiertas | Para saber qué sigue |
| `PROJECT_STATE.md` | Estado técnico, restricciones, decisiones tomadas y bitácora | Antes de tocar código |
