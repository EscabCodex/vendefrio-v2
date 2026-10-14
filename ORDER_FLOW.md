# VendeFrío — Flujo del pedido

## Principio

El pedido se carga **una sola vez** y acompaña toda la operación. Cada etapa es visible, tiene responsable y deja historial, con una claridad similar a la del seguimiento de un envío, pero pensada para una distribuidora.

La operación real es por tandas: el vendedor toma pedidos durante la jornada y los prepara al volver al depósito (o los prepara otra persona que se quedó). No hace falta que el pedido aparezca en el depósito en el mismo minuto.

## Recorrido

```text
Vendedor visita el comercio → elige comercio y productos → carga cantidades y observaciones
→ confirma (se guarda en el celular si no hay internet) → se sincroniza al volver la conexión
→ alguien lo abre en el depósito → lo prepara con checklist (el primer tilde lo pasa a "En preparación")
→ ajusta faltantes con observación → marca preparado (opcional) → sale a repartir → se marca entregado
```

Solo **Cargado** y **Entregado** son obligatorios (decidido en T29a, hecho en T29b). Se puede entregar directo desde "Cargado", por ejemplo en el mostrador, o salir a repartir sin marcar "Preparado".

## Estados

| # | Estado | Significado |
|---|---|---|
| 1 | Pedido cargado | Quien vende lo cargó desde el comercio (antes figuraba como "ingresado") |
| 2 | En preparación | Alguien lo está armando con la checklist: llega solo con el primer tilde (o faltante) |
| 3 | Pedido preparado | Armado y listo en el depósito (opcional: sirve cuando se arma un día y se entrega otro) |
| 4 | En reparto | Salió hacia el comercio ("Salir a repartir") |
| 5 | Pedido entregado | Entregado y confirmado |
| — | Con incidencia | Hay un problema que requiere atención; se marca encima del estado, sin reemplazarlo (supuesto a validar) |
| — | Cancelado | Se anuló; se conserva el motivo |

**Decisión:** no existe un estado separado de "pedido recibido".

**Cargado en el vehículo (hasta T29b):** se juntó con "En reparto". Un pedido que quedó en ese estado se ve y se maneja como "En reparto"; su seguimiento conserva ese paso (el historial no se reescribe).

## Quién hace cada paso (decidido el 2026-10-12)

Cada rol tiene casillas de permiso que marca el dueño. El dueño puede todo.

- **Cualquiera:** cargar pedidos, tildar en la checklist, marcar "Entregado" (desde cualquier paso) y marcar una incidencia (con motivo).
- **Prepara pedidos:** su primer tilde pasa el pedido de "Cargado" a "En preparación" (el tilde de quien no tiene este permiso queda anotado, pero el pedido sigue "Cargado"), anota faltantes y marca "Preparado".
- **Reparte:** "Salir a repartir" (a "En reparto" desde Cargado, En preparación o Preparado) y volverlo al paso que tenía.
- **Cobra:** registra el cobro.
- **Recibe aviso de faltantes:** recibe los avisos de faltantes.
- **Controla pedidos:** cualquier paso de cualquier pedido y resolver incidencias.
- **Solo quien cargó el pedido (y el dueño):** editarlo en cualquier estado, eliminarlo (solo en "Cargado") y cancelarlo (antes de "Entregado", con motivo).
- **Corregir un error:** quien tiene el permiso de un paso lo puede volver atrás, con motivo. Queda en el historial.

## Vistas en la sección Pedido

Pedidos cargados · en preparación · preparados · en reparto (incluye los viejos en "Cargado en el vehículo") · historial (entregados) · incidencias · cancelados, más "A cobrar" para quien cobra. "Preparado" (listo en depósito) y "en reparto" (debe salir o ya está en ruta) son etapas distintas.

## Seguimiento e historial

Cada pedido muestra estado actual, fecha y hora de cada cambio, usuario que lo hizo, comercio de destino, responsable actual, observaciones o incidencia, productos con cantidades e historial de modificaciones.

```text
09:12  Pedido cargado — Jere
09:35  En preparación — Maxi
09:52  Pedido preparado — Maxi
10:20  En reparto — Repartidor
11:05  Entregado — Repartidor
```

## Checklist de preparación

Se ve en la ficha desde "Cargado". Cada producto aparece con su cantidad y una casilla. Sirve para saber qué ya se colocó en los cajones o bultos y qué falta, sin volver a cargar cantidades.

Pueden tildar varias personas a la vez. Para no equivocarse: cada tilde muestra quién lo puso, los tildes se ven en vivo en todos los celulares, no se puede marcar "Preparado" con productos sin tildar ni marcar como faltante, antes de "Preparado" aparece un resumen que se desliza para confirmar, y destildar lo que tildó otro pide confirmación.

## Faltantes y cambios

Si se pidieron 10 unidades y solo hay 8: se ajusta la cantidad preparada a 8, se agrega una observación y se avisa al dueño o responsable económico. El pedido conserva la cantidad original y la preparada. No se bloquea el pedido entero.

## Cambios después de cargado

- Quien cargó el pedido (y el dueño) lo puede editar en cualquier estado. Si alguien ya está trabajando en él, le llega un aviso con lo que cambió ("Agregó 2 Coca 2L · Quitó Sprite · Fanta: de 3 a 5"); la checklist marca los productos a revisar y conserva los tildes de lo que no cambió.
- Dos personas que cambian cosas distintas del mismo pedido no se pisan: cada cambio se guarda por separado.
- **Eliminar** (solo en "Cargado") es para errores, como un pedido repetido. **Cancelar** (antes de "Entregado", con motivo) es para cuando el comercio ya no lo quiere: queda a la vista como "Cancelado" y no cuenta en las estadísticas.

## Entrega

La acción principal es un botón que se desliza: "Entregado". Lo puede hacer cualquiera, desde cualquier paso anterior (Cargado, En preparación, Preparado o En reparto). "Entregar con cambios" ajusta lo entregado de cada producto con motivo (entrega parcial). El comprobante futuro será una boleta simple para imprimir, no una factura fiscal.

## Cobro

Entregar y cobrar son cosas distintas. El cobro es "Pendiente", "Efectivo" o "Transferencia" (con foto opcional del comprobante), y lo registra solo quien tiene el permiso "Cobra". El pedido guarda el precio de cada producto al cargarlo y muestra el total con lo entregado; el monto cobrado se puede corregir. Los pendientes aparecen en "A cobrar".

## Avisos

Cada paso importante avisa a quien le toca (pedido nuevo, preparado, faltante, incidencia, entregado, cobro pendiente y pedido editado), dentro de la app y, si la persona lo activa, con la app cerrada. Nadie recibe aviso de lo que hizo él mismo, y cada uno elige qué avisos recibe.

## Trabajo sin conexión

- Sin internet, el pedido se guarda en el celular y queda marcado como pendiente de sincronizar.
- Al volver la conexión se sincroniza solo, sin intervención del usuario.
- El usuario siempre ve si un pedido ya se sincronizó o no.

## Datos mínimos de un pedido (propuesta técnica a validar)

- Identificador, comercio, creado por, fecha de creación y de última modificación.
- Estado actual y observaciones.
- Productos: producto, precio al cargar, cantidad pedida, cantidad preparada, cantidad entregada, marca de preparado (con quién la puso) y observación por producto.
- Historial de estados: estado, fecha y hora, usuario, nota.
- Ediciones (qué cambió y quién), entrega y cobro (medio, monto, quién y foto opcional).
- Estado de sincronización.

## Reglas

- Nunca se borra el historial de estados.
- Toda modificación importante queda registrada.
- El pedido se puede consultar después de entregado.
- Los estados se cambian fácilmente desde el celular.
- El sistema contempla errores, faltantes, devoluciones y entregas parciales.
- El ticket impreso (T28b) y la facturación futura usan el mismo pedido, sin recargarlo.

## Casos que hay que probar

Carga del pedido · preparación · cambio de estado · modificación · faltante · cancelación · entrega parcial · entrega final · falta de conexión · dos usuarios sobre el mismo pedido · recuperación de datos.

## Futuro

Conexión con stock, facturación, cuentas corrientes, rutas y comprobantes de entrega. El ticket impreso del pedido ya entra en la 1.0 (T28b).
