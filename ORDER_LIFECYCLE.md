# VendeFrío — Ciclo de vida del pedido

## Objetivo

Cada pedido debe tener un estado visible y un seguimiento entendible, similar a la claridad de un envío de Mercado Libre, pero adaptado a una distribuidora.

## Estados principales

1. **Pedido cargado** — alguien tomó y guardó el pedido.
2. **Pedido recibido** — la empresa o el depósito confirmó que lo vio.
3. **Pedido a preparar** — está en la cola de preparación.
4. **Pedido en preparación** — alguien está armándolo.
5. **Pedido preparado** — ya está completo y listo para despacho.
6. **Pedido en reparto** — salió del depósito.
7. **Pedido entregado** — llegó al comercio.
8. **Pedido con incidencia** — existe un problema que requiere atención.
9. **Pedido cancelado** — se anuló y debe conservarse el motivo.

## Vista para el usuario

En la sección Pedido debe existir una organización clara, sin duplicar conceptos:

- Pedidos cargados.
- Pedidos a preparar.
- Pedidos preparados.
- Pedidos a entregar / en reparto.
- Pedidos entregados.
- Incidencias.

“Preparados” y “a entregar” son etapas distintas: preparado significa listo en depósito; a entregar significa que debe salir o ya está en ruta.

## Línea de seguimiento

Cada pedido debe mostrar:

- Estado actual.
- Fecha y hora de cada cambio.
- Usuario que realizó el cambio.
- Comercio de destino.
- Responsable actual, si corresponde.
- Observaciones o incidencia.
- Productos y cantidades.
- Historial de modificaciones.

Ejemplo:

```text
09:12  Pedido cargado — Jeremías
09:18  Pedido recibido — Depósito
09:35  En preparación — Carlos
09:52  Pedido preparado — Carlos
10:20  En reparto — Roberto
11:05  Entregado — Roberto
```

## Reglas

- No borrar el historial de estados.
- Una modificación importante debe quedar registrada.
- El pedido debe seguir siendo consultable después de entregado.
- Los estados deben ser fáciles de cambiar desde el celular.
- El sistema debe contemplar errores, faltantes, devoluciones y entregas parciales.
- La impresión o facturación futura debe usar el mismo pedido, sin volver a cargarlo manualmente.

## Futuro

El flujo podrá conectarse con:

- Stock.
- Facturación.
- Impresión de boletas.
- Cuentas corrientes.
- Rutas.
- Notificaciones.
- Comprobantes de entrega.
