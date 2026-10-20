# VendeFrío — Roadmap

No es una lista rígida de pantallas: es el orden para llegar a calidad de producto. El alcance de la 1.0 está en `PRODUCT.md`.

## Hacia la versión 1.0 (propuesta de plan: unas 4 semanas)

**Etapa 1 — Base**
- Consolidar la documentación (este conjunto de 6 archivos).
- Revisar que el repo público no exponga claves (por ejemplo, la configuración de MapTiler).
- Elegir el servicio de datos compartidos y definir la arquitectura. Es la decisión técnica más importante.

**Etapa 2 — Datos compartidos**
- Cuenta de la distribuidora con varios usuarios: pantalla de inicio, registro del encargado, ingreso de empleados con código y panel de empleados (Bloque E de `PROJECT_STATE.md`).
- Pasar los módulos de `localStorage` a datos compartidos, sin perder lo que ya está cargado. Al final, con cuenta o con código la app usa solo la nube; sin sesión queda el modo personal, con los datos solo en ese celular (T16 "Solo nube").
- Respaldo y recuperación de datos.

**Etapa 3 — Pedido completo** (decidida el 2026-10-12; tareas T18 a T29 en el Bloque F de `PROJECT_STATE.md`)
- Ciclo de estados con historial, responsables y permisos por rol.
- Checklist de preparación, faltantes, entrega y cobro con foto opcional.
- Ticket impreso del pedido por Bluetooth, solo Android (T28b).
- Avisos dentro de la app y notificaciones con la app cerrada.
- Trabajo sin conexión con sincronización automática.

**Etapa 4 — Pulido y cierre** (estilo aprobado el 2026-10-15; tareas T30 a T38 en el Bloque H de `PROJECT_STATE.md`)
- Rework visual completo de la app. Incluye pasar el indicador de conexión (T12) arriba a la derecha del nombre, en lugar de "Reparto Activo".
- Pruebas en celulares reales, modo claro y oscuro, y PWA.
- Cierre de la 1.0 y prueba en el trabajo diario.

**Etapa 5 — Navegación propia y voz** (idea del dueño, 2026-10-15). Va apenas termina la Etapa 4, sin esperar decisiones del dueño ("hacé la navegación como mejor te parezca"). Solo opciones gratis y sin claves: Leaflet con OpenStreetMap, el OSRM público y la voz del navegador (Web Speech API). Lo que necesite una cuenta, una clave o un servicio pago queda armado detrás de un ajuste y pasa a la lista de tareas del dueño.
- Navegación estilo Uber o DiDi, pero del lado del cliente: mapa 2D con la posición en todo momento y una línea azul con el camino; abajo, una hoja que se desliza hacia arriba con los datos del comercio y todas sus opciones (cargar pedido, llamar, entregar).
- Indicaciones paso a paso con voz ("en 150 m doblá a la izquierda"), para dejar de usar Google Maps. Necesita un servicio de calles (por ejemplo OpenRouteService u OSRM, con plan gratis) y la voz del celular. Una app web no sigue el GPS con la pantalla apagada.
- Comandos por voz ("próxima parada", "marcar entregado"), con el reconocimiento de voz de Chrome en Android y con internet.
- Cargar pedidos con un audio, como un audio de WhatsApp: se pasa a texto y se arma el pedido con los productos del catálogo para revisarlo antes de guardar. Pasar a texto con buena calidad probablemente necesite un servicio pago; hay que decidirlo.

Plan detallado en el Bloque I de `PROJECT_STATE.md` (T40 a T44).

**Etapa 6 — Lista para la 1.0** (agregada por Claude con permiso del dueño, 2026-10-15: "agregá todas las ideas útiles para una app 1.0"). Cosas chicas que hacen que la app se sienta terminada, todas gratis y sin claves. Plan en el Bloque J de `PROJECT_STATE.md` (T45 a T49).
- Primeros pasos para una cuenta nueva (cargar productos, comercios y el primer pedido) y "Qué hay de nuevo" después de cada actualización.
- "Para visitar hoy": los comercios que suelen pedir ese día de la semana, según su historial.
- Exportar pedidos y cobros a una planilla (CSV) para el contador.
- Repaso de accesibilidad y velocidad: botones grandes, textos para lectores de pantalla y carga más liviana.

Si algo se atrasa, se mueve a "Después de la 1.0". Prioridad: una 1.0 sólida y usable antes que todo a medias.

**Pedidos por WhatsApp** (pedido del dueño, 2026-10-15). Mandar a muchos comercios "¿tenías pedido?" con su nombre y que las respuestas, en texto o audio, queden como pedido. Lo gratis anda sin cuentas (un toque por comercio y "Compartir a VendeFrío"); lo automático usa la API oficial de WhatsApp de Meta, que cobra por mensaje, y queda apagado hasta que el dueño conecte la cuenta (M16). Plan en el Bloque K de `PROJECT_STATE.md` (T55 a T59).

**Etapa 8 — Más simple para todos** (pedido del dueño, 2026-10-17, con capturas). Que la app la entienda sin ayuda una persona de 50 o 60 años, que la plata quede solo para quien corresponde y que Nuevo pedido sea más limpio. Plan en el Bloque M de `PROJECT_STATE.md` (T93 a T99). **Hecha (2026-10-18)**, en `desarrollo`; la segunda parte de la simplificación (ficha del comercio, Pedidos, Más y Catálogo) espera que el dueño apruebe la propuesta.
- La plata solo para el dueño o quien él autorice: los empleados sin permiso de cobrar no ven montos en Inicio, Estadísticas ni ningún resumen de venta.
- Nuevo pedido más limpio: "Lo de siempre" desplegable y compacto, sin "Lo que más compra"; un solo botón flotante de tres puntitos en lugar de los botones de arriba; marcas desplegables; cambios y precio especial al alcance de un toque.
- Pasada de simplificación de toda la app: textos más cortos y claros, funciones agrupadas, un solo botón flotante donde hay muchos botones y más gestos de mantener apretado.

## Después de la 1.0

1. **Stock conectado:** stock físico, reservado y disponible; reserva al confirmar pedidos; alertas de reposición y planificación de carga desde fábrica.
2. **Operación comercial:** cuentas corrientes y comprobantes simples (el ticket impreso del pedido ya entra en la 1.0, T28b).
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

Cerradas el 2026-10-12 (T17): qué pasa si dos personas modifican el mismo pedido y quién puede cambiar cada estado. Ver "Pedido completo, Etapa 3" en `PROJECT_STATE.md`.

Cerrada el 2026-10-13: qué impresora o dispositivo se usará. Una GOOJPRT MTP-3 por Bluetooth BLE, solo desde Android (Chrome). El ticket es un remito, no válido como factura (T28b). Ver "Impresión de tickets" en `PROJECT_STATE.md`.

- ¿Qué datos mínimos necesita el depósito para preparar? Propuesta en T24 (comercio, autor, observaciones y productos por marca con cantidad); se confirma al probarla.
- ¿Qué diferencia hay entre pedido, remito, factura y entrega?

## Cómo se decide

Antes de desarrollar cualquier cosa hay que poder responder: qué usuario lo necesita, qué problema concreto resuelve, cuánto tiempo o error ahorra, qué datos necesita, cómo se prueba, qué riesgo agrega y si puede convertirse en algo por lo que alguien pague.

## Prohibido por ahora

- Cambiar la tecnología base sin decisión explícita.
- Agregar funciones solo porque parecen modernas.
- Mezclar propuestas de varias IAs sin una decisión consolidada.
