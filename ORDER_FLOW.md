# VendeFrío — Flujo del pedido

## Principio

El pedido se carga **una sola vez** y acompaña toda la operación. Cada etapa es visible, tiene responsable y deja historial, con una claridad similar a la del seguimiento de un envío, pero pensada para una distribuidora.

La operación real es por tandas: el vendedor toma pedidos durante la jornada y los prepara al volver al depósito (o los prepara otra persona que se quedó). No hace falta que el pedido aparezca en el depósito en el mismo minuto.

## Recorrido

```text
Vendedor visita el comercio → elige comercio y productos → carga cantidades y observaciones
→ confirma (se guarda en el celular si no hay internet) → se sincroniza al volver la conexión
→ alguien lo abre en el depósito → lo prepara con checklist → ajusta faltantes con observación
→ marca preparado → se carga al vehículo → sale a reparto → se marca entregado
```

## Estados

| # | Estado | Significado |
|---|---|---|
| 1 | Pedido ingresado | El vendedor lo cargó desde el comercio |
| 2 | En preparación | Alguien lo está armando con la checklist |
| 3 | Pedido preparado | Armado y listo en el depósito |
| 4 | Cargado en el vehículo | Revisado y subido |
| 5 | En reparto | Salió hacia el comercio |
| 6 | Pedido entregado | Entregado y confirmado |
| — | Con incidencia | Hay un problema que requiere atención |
| — | Cancelado | Se anuló; se conserva el motivo |

**Decisión:** no existe un estado separado de "pedido recibido".

## Vistas en la sección Pedido

Pedidos cargados · a preparar · preparados · a entregar o en reparto · entregados · incidencias. "Preparado" (listo en depósito) y "a entregar" (debe salir o ya está en ruta) son etapas distintas.

## Seguimiento e historial

Cada pedido muestra estado actual, fecha y hora de cada cambio, usuario que lo hizo, comercio de destino, responsable actual, observaciones o incidencia, productos con cantidades e historial de modificaciones.

```text
09:12  Pedido ingresado — Vendedor
09:35  En preparación — Depósito
09:52  Pedido preparado — Depósito
10:20  En reparto — Repartidor
11:05  Entregado — Repartidor
```

## Checklist de preparación

Cada producto aparece con su cantidad y una casilla. Sirve para saber qué ya se colocó en los cajones o bultos y qué falta, sin volver a cargar cantidades.

## Faltantes y cambios

Si se pidieron 10 unidades y solo hay 8: se ajusta la cantidad preparada a 8, se agrega una observación y se avisa al dueño o responsable económico. El pedido conserva la cantidad original y la preparada. No se bloquea el pedido entero.

## Entrega

La acción principal es "Marcar como entregado". Cuando corresponda se puede adjuntar una foto del comprobante de transferencia. El comprobante futuro será una boleta simple para imprimir, no una factura fiscal.

## Trabajo sin conexión

- Sin internet, el pedido se guarda en el celular y queda marcado como pendiente de sincronizar.
- Al volver la conexión se sincroniza solo, sin intervención del usuario.
- El usuario siempre ve si un pedido ya se sincronizó o no.

## Datos mínimos de un pedido (propuesta técnica a validar)

- Identificador, comercio, creado por, fecha de creación y de última modificación.
- Estado actual y observaciones.
- Productos: producto, cantidad pedida, cantidad preparada, marca de preparado y observación por producto.
- Historial de estados: estado, fecha y hora, usuario, nota.
- Estado de sincronización.

## Reglas

- Nunca se borra el historial de estados.
- Toda modificación importante queda registrada.
- El pedido se puede consultar después de entregado.
- Los estados se cambian fácilmente desde el celular.
- El sistema contempla errores, faltantes, devoluciones y entregas parciales.
- La impresión y la facturación futuras usan el mismo pedido, sin recargarlo.

## Casos que hay que probar

Carga del pedido · preparación · cambio de estado · modificación · faltante · cancelación · entrega parcial · entrega final · falta de conexión · dos usuarios sobre el mismo pedido · recuperación de datos.

## Futuro

Conexión con stock, facturación, impresión de boletas, cuentas corrientes, rutas, notificaciones y comprobantes de entrega.
