# VendeFrío — Roadmap

No es una lista rígida de pantallas: es el orden para llegar a calidad de producto. El alcance de la 1.0 está en `PRODUCT.md`.

## Hacia la versión 1.0 (propuesta de plan: unas 4 semanas)

**Etapa 1 — Base**
- Consolidar la documentación (este conjunto de 6 archivos).
- Revisar que el repo público no exponga claves (por ejemplo, la configuración de MapTiler).
- Elegir el servicio de datos compartidos y definir la arquitectura. Es la decisión técnica más importante.

**Etapa 2 — Datos compartidos**
- Cuenta de la distribuidora con varios usuarios.
- Pasar los módulos de `localStorage` a datos compartidos, sin perder lo que ya está cargado.
- Respaldo y recuperación de datos.

**Etapa 3 — Pedido completo**
- Ciclo de estados con historial y responsables.
- Checklist de preparación, faltantes y entrega con foto opcional.
- Trabajo sin conexión con sincronización automática.

**Etapa 4 — Pulido y cierre**
- Rework visual completo de la app.
- Pruebas en celulares reales, modo claro y oscuro, y PWA.
- Cierre de la 1.0 y prueba en el trabajo diario.

Si algo se atrasa, se mueve a "Después de la 1.0". Prioridad: una 1.0 sólida y usable antes que todo a medias.

## Después de la 1.0

1. **Stock conectado:** stock físico, reservado y disponible; reserva al confirmar pedidos; alertas de reposición y planificación de carga desde fábrica.
2. **Operación comercial:** cuentas corrientes, comprobantes simples, impresión de boletas.
3. **Facturación** fiscal e integraciones contables, según el país.
4. **Inteligencia comercial:** comercios sin visitar, pedidos inusuales, productos de baja rotación, resúmenes accionables.
5. **Producto comercializable:** multiempresa, planes de pago, panel para distribuidoras, soporte y documentación.

## Tareas abiertas

- [ ] Aprobar la visión y el alcance de la 1.0 (`PRODUCT.md`).
- [x] Elegir el servicio de datos compartidos.
- [ ] Definir los tres problemas de mayor valor.
- [ ] Definir qué funciones son esenciales y cuáles secundarias.
- [ ] Definir qué podría justificar un pago.
- [ ] Definir la diferencia entre stock físico, reservado y disponible (para después de la 1.0).
- [ ] Rework visual completo.

## Decisiones abiertas

- ¿Qué pasa si dos personas modifican el mismo pedido a la vez?
- ¿Quién puede cambiar cada estado?
- ¿Qué datos mínimos necesita el depósito para preparar?
- ¿Cómo entra un empleado nuevo a la cuenta de la distribuidora?
- ¿Qué diferencia hay entre pedido, remito, factura y entrega?
- ¿Qué impresora o dispositivo se usará más adelante?

## Cómo se decide

Antes de desarrollar cualquier cosa hay que poder responder: qué usuario lo necesita, qué problema concreto resuelve, cuánto tiempo o error ahorra, qué datos necesita, cómo se prueba, qué riesgo agrega y si puede convertirse en algo por lo que alguien pague.

## Prohibido por ahora

- Cambiar la tecnología base sin decisión explícita.
- Agregar funciones solo porque parecen modernas.
- Mezclar propuestas de varias IAs sin una decisión consolidada.
