# VendeFrío — Decisiones del usuario, ronda 1

## Segmento inicial

La primera versión profesional apunta a distribuidoras pequeñas, medianas y mayoristas de barrio con reparto propio. No se apunta inicialmente a grandes empresas nacionales: requerirían una escala, infraestructura y ciberseguridad superiores.

## Cuenta compartida

La cuenta representa el centro de información de la distribuidora. Pueden usarla el dueño, preventista, personal que arma pedidos, chofer, ayudante, repartidor y persona que prepara boletas.

En la primera versión todos los usuarios autorizados ven los mismos datos. La separación estricta por roles queda para una etapa posterior si hace falta.

## Conectividad

No es necesario que el pedido aparezca en el depósito en el mismo minuto en que se carga. Si no hay internet, debe guardarse en el celular y sincronizarse automáticamente cuando vuelva la conexión.

La operación real suele ser por tandas: el vendedor toma pedidos durante la jornada y luego vuelve al depósito a prepararlos. También puede prepararlos otra persona que permanezca en el depósito.

## Estados iniciales

```text
Pedido ingresado
→ En preparación
→ Pedido preparado
→ Cargado en el vehículo
→ En reparto
→ Entregado
```

No se necesita un estado separado de “pedido recibido”.

## Preparación

El pedido debe convertirse en una checklist. Cada producto muestra su cantidad y una casilla para marcarlo mientras se coloca en cajones o bultos.

## Faltantes

Si se pidieron 10 unidades y solo hay 8:

- Se ajusta la cantidad preparada a 8.
- Se deja una observación.
- Se avisa al dueño o responsable económico.
- Se conserva el pedido original y el cambio realizado.

## Entrega

La acción principal será “Marcar como entregado”. También se podrá adjuntar una foto del comprobante de transferencia cuando corresponda.

## Comprobante futuro

Se prioriza generar una boleta o comprobante simple para imprimir. No se exige inicialmente una factura fiscal válida en Argentina.
