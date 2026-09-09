# VendeFrío — Ciclo de vida del pedido

## Objetivo

Cada pedido debe tener un estado visible y un seguimiento entendible, similar a la claridad de un envío de Mercado Libre, pero adaptado a una distribuidora.

## Estados principales

1. **Pedido ingresado** — el vendedor lo cargó desde el comercio. No hace falta una etapa de “recibido”: el equipo lo prepara cuando vuelve al depósito.
2. **Pedido en preparación** — alguien está armándolo y usa la checklist de productos.
3. **Pedido preparado** — ya fue armado y está listo para subir al vehículo.
4. **Cargado en el vehículo** — la mercadería fue revisada y subida.
5. **En reparto** — salió del depósito hacia el comercio.
6. **Pedido entregado** — llegó al comercio y se confirmó la entrega.
7. **Pedido con incidencia** — existe un problema que requiere atención.
8. **Pedido cancelado** — se anuló y debe conservarse el motivo.

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

## Checklist de preparación

Mientras se arma el pedido, cada producto debe mostrarse con su cantidad y una casilla para marcarlo.

```text
[✓] 5 paquetes de producto A
[ ] 3 cajas de producto B
[✓] 2 bolsas de producto C
```

La checklist debe permitir saber qué ya se colocó en los cajones y qué falta, sin volver a cargar cantidades.

## Faltantes y cambios

Si se pidieron 10 unidades y solo hay 8:

- El responsable de preparación ajusta la cantidad a 8.
- Agrega una observación.
- El pedido conserva el dato original y el dato preparado.
- Se avisa al dueño o responsable económico.
- No hace falta bloquear todo el pedido.

## Entrega

La confirmación principal será tocar “Marcar como entregado”. Cuando corresponda, se podrá adjuntar una foto del comprobante de transferencia.

## Reglas

- No borrar el historial de estados.
- Una modificación importante debe quedar registrada.
- El pedido debe seguir siendo consultable después de entregado.
- Los estados deben ser fáciles de cambiar desde el celular.
- El sistema debe contemplar errores, faltantes, devoluciones y entregas parciales.
- La impresión o facturación futura debe usar el mismo pedido, sin volver a cargarlo manualmente.
- Si no hay conexión, el pedido se guarda localmente y se sincroniza al recuperar internet.

## Futuro

El flujo podrá conectarse con:

- Stock.
- Facturación.
- Impresión de boletas.
- Cuentas corrientes.
- Rutas.
- Notificaciones.
- Comprobantes de entrega.
