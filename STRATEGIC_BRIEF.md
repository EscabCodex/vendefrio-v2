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

### Usuario inicial prioritario

La persona que toma pedidos y visita comercios durante la jornada.

### Segundo usuario prioritario

La persona del depósito que recibe y prepara los pedidos.

### Comprador futuro

El dueño o responsable de una distribuidora que necesita coordinar vendedores, depósito, reparto y administración.

## 4. Propuesta de valor inicial

> VendeFrío permite tomar pedidos desde el celular y hacer que el depósito los reciba, prepare y entregue sin depender de papeles ni mensajes manuales.

## 5. Flujo principal

```text
Vendedor visita comercio
→ selecciona comercio y productos
→ carga cantidades y observaciones
→ confirma pedido
→ el pedido queda disponible para la empresa
→ depósito lo recibe
→ lo prepara
→ lo marca como preparado
→ reparto lo retira
→ lo entrega
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

## 7. Pilares del producto

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
