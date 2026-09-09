# VendeFrío — Brief estratégico inicial

**Versión:** 0.1
**Fecha:** 2026-09-09
**Estado:** En definición, sin implementación

## 1. Qué queremos construir

VendeFrío será una plataforma móvil para distribuidoras y empresas que venden productos a comercios. Permitirá que el pedido se cargue una sola vez y acompañe toda la operación: venta, recepción, preparación, despacho, reparto, entrega, stock y facturación.

La experiencia debe ser simple para quien trabaja en la calle y suficientemente estructurada para que depósito, reparto y administración puedan trabajar sobre la misma información.

## 2. Problema que resolvemos

Muchas operaciones dependen de cuadernos, listas impresas, mensajes de WhatsApp, boletas físicas y comunicación verbal. Esto provoca errores, demoras, pérdida de información y dependencia de una persona específica.

VendeFrío debe reemplazar ese circuito fragmentado por un flujo digital compartido, visible y trazable.

## 3. Usuario y comprador

### Segmento inicial

Distribuidoras pequeñas y medianas, mayoristas de barrio y negocios minoristas con reparto propio. No se apunta inicialmente a grandes empresas nacionales: requieren una escala, ciberseguridad, soporte e infraestructura fuera del alcance de esta primera versión.

### Usuarios de una misma cuenta

Todos los integrantes autorizados trabajan sobre el mismo centro de información y ven los mismos datos:

- Preventista o corredor.
- Dueño o encargado.
- Personal que arma pedidos.
- Chofer y ayudante.
- Repartidor.
- Persona que prepara boletas.

La primera versión no separa radicalmente la información por rol. La prioridad es que el equipo comparta el mismo estado real de los pedidos.

### Comprador

El dueño o responsable de una distribuidora pequeña o mediana que hoy depende de papeles, mensajes y memoria para coordinar ventas, depósito y reparto.

## 4. Propuesta de valor inicial

> VendeFrío permite tomar pedidos desde el celular y hacer que el depósito los reciba, prepare y entregue sin depender de papeles ni mensajes manuales.

## 5. Flujo principal

La operación real no requiere que haya alguien preparando pedidos mientras el vendedor está en la calle. El pedido se sincroniza cuando exista conexión y queda disponible para armarlo cuando el vendedor, el dueño o el personal del camión llegan al depósito.

```text
Vendedor visita comercio
→ repone, ordena y controla la mercadería
→ selecciona comercio y productos
→ carga cantidades y observaciones
→ confirma pedido ingresado
→ se guarda localmente si no hay conexión
→ se sincroniza automáticamente al recuperar internet
→ alguien del equipo abre el pedido en el depósito
→ marca productos en una checklist mientras los coloca en cajones
→ registra faltantes y ajusta cantidades con observación
→ avisa al dueño o responsable económico
→ marca pedido preparado
→ se carga al vehículo
→ sale a reparto
→ se marca entregado
→ se adjunta foto del comprobante de transferencia si corresponde
→ queda el historial completo
```

## 6. Seguimiento del pedido

Cada pedido debe tener una línea de tiempo visible:

- Pedido cargado.
- Pedido recibido.
- A preparar.
- En preparación.
- Preparado.
- En reparto.
- Entregado.
- Incidencia o cancelación cuando corresponda.

La interfaz debe comunicar rápidamente dónde está el pedido, quién lo tiene y qué falta para completarlo.

## 7. Stock conectado con la venta

En una etapa futura, quien toma pedidos podrá consultar desde la calle el stock disponible del depósito antes de ofrecer productos.

Cuando confirme un pedido, la cantidad deberá reservarse o descontarse de forma controlada para que los pedidos posteriores no ofrezcan unidades que ya fueron comprometidas.

Esto permitirá:

- Tomar pedidos con información real.
- Evitar faltantes descubiertos al preparar.
- Saber qué productos quedan disponibles.
- Agrupar pedidos de forma más inteligente.
- Decidir cuándo conviene viajar a fábrica.
- Evitar viajes innecesarios y gastos de combustible.
- Planificar la carga según los pedidos ya tomados.

Este punto requiere definir más adelante la diferencia entre stock físico, stock reservado y stock disponible.

## 8. Pilares del producto

### Venta

Carga rápida, catálogo, precios, comercios, repetición de pedidos y comunicación clara.

### Operación

Bandeja compartida, estados, responsables, preparación, despacho, entrega e incidencias.

### Administración

Stock, cuentas, facturación, comprobantes e impresión.

### Inteligencia

Alertas, reposición, evolución de ventas, clientes sin visitar y decisiones accionables.

## 8. Qué significa calidad profesional

- La información importante aparece sin buscar demasiado.
- El usuario puede hacer tareas frecuentes con una mano.
- Los estados son claros y no ambiguos.
- Los errores se pueden corregir sin perder trazabilidad.
- La aplicación no depende de una sola persona.
- Los datos se recuperan si se pierde un dispositivo.
- La experiencia funciona bien en celulares reales.
- La interfaz transmite confianza y orden.
- Cada función tiene una razón operativa.

## 9. No objetivos inmediatos

Por ahora no se implementan:

- Facturación fiscal real.
- Integraciones contables.
- Impresión Bluetooth definitiva.
- Multiempresa real.
- Sincronización remota definitiva.
- Suscripciones.
- Inteligencia artificial dentro de la app.
- Cambios grandes de diseño sin validación del flujo.

No se descartan: se reservan para fases posteriores y se diseñan desde ahora para no bloquearlas.

## 10. Decisiones que el equipo debe investigar

- ¿Qué datos mínimos necesita depósito para preparar?
- ¿Quién puede cambiar cada estado?
- ¿Qué ocurre con faltantes o cambios de cantidad?
- ¿Cómo se trabaja sin conexión?
- ¿Cómo se sincroniza una cuenta compartida?
- ¿Qué dispositivo o impresora se usará?
- ¿Qué comprobante necesita cada tipo de cliente?
- ¿Qué diferencia hay entre pedido, factura, remito y entrega?
- ¿Qué información puede ver cada rol?

## 11. Criterio para aprobar ideas

Una propuesta avanza si:

1. Resuelve un problema frecuente.
2. Ahorra tiempo o reduce errores.
3. Puede ser comprendida por un usuario no técnico.
4. Encaja en el flujo completo del pedido.
5. No crea una dependencia innecesaria.
6. Puede probarse con un caso real.
7. Aporta valor suficiente para una futura versión paga.
