# VENDEFRÍO — DOCUMENTO MAESTRO DE COORDINACIÓN
> Archivo único para compartir con agentes. Reúne la documentación oficial actual del proyecto.


---

# DOCUMENTO: PRODUCT_VISION.md

# VendeFrío — Visión de producto

## Ambición

Construir una aplicación profesional para preventistas, corredores, tomadores de pedidos y repartidores que permita trabajar más rápido, con menos errores y con mejor control de la operación diaria.

La meta no es solamente que la app funcione: debe alcanzar un nivel de calidad por el que un trabajador o una empresa considere razonable pagar.

## Posicionamiento

VendeFrío debe sentirse como una herramienta de trabajo profesional, no como una planilla mejorada ni como una app personal improvisada.

Debe ayudar a:

- Tomar pedidos rápidamente.
- Consultar productos y precios sin perder tiempo.
- Organizar comercios y visitas.
- Recordar recorridos y próximas paradas.
- Reducir errores de carga y comunicación.
- Repetir pedidos habituales.
- Consultar historial y evolución comercial.
- Planificar rutas.
- Trabajar desde el celular, incluso en situaciones de poca conectividad.
- Convertir datos diarios en decisiones útiles.

## Usuarios principales

VendeFrío está dirigida principalmente a distribuidoras y empresas que venden y reparten productos a almacenes, supermercados, kioscos y otros comercios.

Ejemplos de contexto: distribuidoras de alimentos, panificados, pastas, bebidas, golosinas o productos de consumo masivo; también empresas con preventistas, vendedores y reparto propio.

Usuarios dentro de una misma operación:

1. Preventistas y corredores que visitan comercios y toman pedidos.
2. Tomadores de pedidos que cargan pedidos durante la jornada.
3. Encargados o dueños que también salen a vender.
4. Personal de depósito que prepara los pedidos.
5. Repartidores que consultan pedidos, comercios, rutas y entregas.
6. Administradores que necesitan stock, facturación, cuentas y control.

## Problema central

La operación suele depender de anotaciones en cuadernos, menús impresos, mensajes escritos a mano, boletas físicas y comunicación fragmentada. Eso genera pérdida de tiempo, errores de interpretación, pedidos que llegan tarde al depósito y dependencia de papeles para empezar a preparar una entrega.

## Promesa central

VendeFrío debe convertir el pedido tomado en el comercio en información operativa lista para que otra persona pueda verlo, prepararlo y entregarlo, sin tener que esperar una boleta física ni descifrar mensajes manuales.

## Flujo estratégico principal

```text
El vendedor toma el pedido
→ lo carga una sola vez
→ el pedido queda disponible para la empresa
→ depósito lo recibe y lo prepara
→ administración puede controlarlo y facturarlo
→ reparto lo consulta y lo entrega
```

La aplicación debe evolucionar desde una herramienta individual para tomar pedidos hacia una plataforma compartida de operación comercial.

## Evolución prevista

- Pedidos compartidos entre varias personas de una misma cuenta.
- Bandeja de pedidos recibidos.
- Submenús por etapa: cargados, a preparar, preparados, en reparto, entregados e incidencias.
- Seguimiento visual de cada pedido, con una experiencia clara similar al tracking de un envío.
- Historial de estados con fecha, hora y usuario responsable.
- Acceso del depósito a los pedidos sin depender del papel.
- Registro de preparación, despacho, entrega parcial, faltantes y devoluciones.
- Stock de depósito visible para quien toma pedidos.
- Stock disponible actualizado para evitar ofrecer mercadería inexistente.
- Reserva o descuento de stock al confirmar pedidos, sin contar dos veces la misma mercadería.
- Alertas de reposición y sugerencia de cuándo volver a cargar desde fábrica.
- Facturación y emisión de comprobantes.
- Impresión de boletas desde la aplicación cuando exista una impresora compatible.
- Cuentas, permisos y roles.
- Historial de quién tomó, modificó, preparó, despachó y entregó cada pedido.
- Comprobante digital de entrega.

## Principios

- Primero utilidad real; después decoración.
- Menos toques y menos escritura manual.
- Claridad antes que cantidad de funciones.
- Datos seguros y recuperables.
- Experiencia excelente en celular.
- Cada función debe resolver un problema concreto.
- La app debe poder crecer sin perder simplicidad.
- No romper funciones, datos, navegación ni compatibilidad existentes.

## Norte de calidad

Cada pantalla debe poder responder afirmativamente:

- ¿Se entiende en pocos segundos?
- ¿Se puede usar con una mano?
- ¿Reduce tiempo o errores?
- ¿Se siente confiable?
- ¿Funciona bien en un celular común?
- ¿Tiene una razón clara para existir?
- ¿Podría formar parte de una app comercial paga?


---

# DOCUMENTO: PROJECT_STATE.md

# VendeFrío — Estado del proyecto

**Última actualización:** 2026-09-09
**Repositorio:** `EscabCodex/vendefrio-v2`
**Branch:** `main`
**Preview:** `https://vendefrio-v2.vercel.app/`
**Fuente de verdad:** GitHub
**Zona de prueba:** Vercel

## Estado actual

VendeFrío es una PWA de HTML, CSS y JavaScript puro, con datos locales en `localStorage`.

La base funcional ya incluye:

- Dashboard.
- Pedido y borrador persistente.
- Comercios y fichas individuales.
- Catálogo y productos.
- Historial.
- Estadísticas.
- Rutas, GPS y mapas.
- Configuración y respaldos.
- Barra inferior y menú Más.
- Íconos SVG propios.
- Modales tipo bottom sheet.
- Toasts.
- Transiciones.
- Háptica en acciones compatibles.
- Safe areas para celulares modernos.
- PWA y service worker.
- Integración de MapTiler mediante configuración segura.

## Decisión actual

Se pausa cualquier nueva implementación hasta terminar de definir visión, equipo, reglas de coordinación y roadmap de producto.

No se inicia otra fase técnica todavía.

## Restricciones

- No migrar de tecnología sin una decisión explícita.
- No modificar código desde varios agentes simultáneamente.
- No reemplazar archivos parcialmente.
- No perder datos de `localStorage`.
- No introducir confirmaciones nativas del navegador.
- No cambiar funciones existentes solo por estética.
- Toda mejora debe tener objetivo, criterio de aceptación y plan de prueba.

## Próxima decisión pendiente

Definir el primer gran bloque estratégico del producto después de aprobar la visión y el equipo.


---

# DOCUMENTO: TEAM.md

# VendeFrío — Equipo de trabajo

## Regla principal

Un solo agente modifica el código principal por vez. El resto analiza, propone, critica o prepara especificaciones.

## Integrantes y responsabilidades

### Zapia — Dirección y coordinación

- Custodia la visión del producto.
- Convierte ideas en decisiones concretas.
- Ordena prioridades.
- Coordina agentes.
- Revisa consistencia entre propuestas.
- Mantiene el estado, roadmap y tareas.
- Decide cuándo una propuesta está lista para pasar a Claude.

### Claude — Ingeniería principal

- Programa e integra.
- Trabaja sobre la versión aprobada del repositorio.
- Entrega archivos completos.
- Conserva funciones, datos y compatibilidad.
- Prueba antes de entregar.
- Informa archivos modificados, riesgos y pruebas realizadas.

### Gemini — Exploración visual y conceptual

- Propone referencias visuales.
- Explora estilos, pantallas e ilustraciones.
- Genera alternativas de iconografía y recursos gráficos.
- No define por sí solo la solución final ni modifica código.

### Leonardo u otro generador visual — Recursos gráficos

- Produce imágenes, ilustraciones y variantes de alta calidad.
- Se utiliza cuando un recurso visual concreto lo justifica.
- Sus imágenes son referencias o assets aprobados; no se incorporan sin revisión.

### Agente analítico — Producto y experiencia

- Analiza flujos de usuario.
- Detecta pasos innecesarios.
- Compara alternativas.
- Propone funciones por impacto real.
- Revisa que la app pueda justificar un producto pago.

### Agente crítico — Segunda opinión

- Cuestiona decisiones.
- Busca problemas, contradicciones y riesgos.
- Evalúa si una solución parece profesional o improvisada.
- No critica sin proponer una alternativa útil.

### QA — Calidad y pruebas

- Diseña casos de prueba.
- Revisa regresiones.
- Verifica celular, PWA, modo oscuro, datos y navegación.
- Prueba criterios de aceptación antes del cierre.

### Jeremías — Dueño del producto y prueba real

- Define problemas reales del trabajo diario.
- Decide prioridades de negocio.
- Sube los archivos a GitHub.
- Prueba en Vercel y en su celular.
- Informa fallos agrupados después de cada entrega.

## Flujo de trabajo

1. Zapia define el problema y prepara el brief.
2. Los agentes de análisis, visual y crítica aportan propuestas.
3. Zapia consolida una única decisión.
4. Claude recibe una especificación cerrada.
5. Claude modifica el código y entrega archivos completos.
6. Jeremías sube a GitHub y prueba en Vercel.
7. QA y Zapia revisan los resultados.
8. Se registra la decisión y se abre el siguiente bloque.


---

# DOCUMENTO: AGENT_PROTOCOL.md

# VendeFrío — Protocolo común para agentes

## Contexto obligatorio

VendeFrío es una PWA móvil para preventistas, corredores, tomadores de pedidos y repartidores. El objetivo es convertirla en una herramienta profesional, rápida, confiable y potencialmente comercializable.

Repositorio: `EscabCodex/vendefrio-v2`
Branch: `main`
Fuente de verdad: GitHub
Preview: Vercel
Tecnología actual: HTML, CSS y JavaScript puro con `localStorage`.

## Reglas

- No inventar el estado del proyecto: declarar supuestos.
- No modificar código salvo que la tarea lo autorice explícitamente.
- No pisar el trabajo de otro agente.
- No proponer migraciones grandes sin justificar beneficio, costo y riesgo.
- Priorizar problemas reales del trabajo diario.
- Preservar datos, navegación, pedidos, catálogo, comercios, historial, rutas, mapas y PWA.
- Proponer una sola recomendación principal y hasta dos alternativas.
- Señalar riesgos y dependencias.
- Separar hechos, opiniones y propuestas.
- No considerar una tarea terminada solo porque el código compila.

## Formato de respuesta

### Objetivo
Qué problema se intenta resolver.

### Observaciones
Qué se sabe y qué no se sabe.

### Recomendación principal
La propuesta elegida y por qué.

### Alternativas
Solo si son realmente útiles.

### Riesgos
Qué podría romperse o salir mal.

### Criterios de aceptación
Cómo sabremos que funciona.

### Próximo paso
Qué debe hacer el siguiente integrante del equipo.

## Estado de una propuesta

- IDEA: todavía abierta.
- EN ANÁLISIS: se está evaluando.
- APROBADA: Zapia la consolidó.
- EN DESARROLLO: Claude la está implementando.
- EN PRUEBA: Jeremías y QA la están probando.
- CERRADA: se comprobó y registró.
- DESCARTADA: se dejó constancia del motivo.


---

# DOCUMENTO: ROADMAP.md

# VendeFrío — Roadmap estratégico

Este roadmap no es una lista rígida de pantallas. Es el orden para alcanzar calidad de producto.

## Horizonte 1 — Definición de producto

- Aprobar visión.
- Definir usuarios prioritarios.
- Definir problemas más valiosos.
- Definir qué justificaría pagar.
- Elegir métricas de éxito.
- Ordenar el alcance inicial.

## Horizonte 2 — Producto esencial excelente

- Pedido extremadamente rápido.
- Catálogo y precios confiables.
- Comercios fáciles de consultar.
- Historial útil para repetir y analizar.
- Datos protegidos y recuperables.
- Funcionamiento sólido en celular y con conectividad irregular.
- Pedido digital claro, listo para compartir y preparar.

## Horizonte 3 — Operación compartida de la distribuidora

- Cuentas de empresa con varios usuarios.
- Roles para vendedor, encargado, depósito, reparto y administración.
- Bandeja de pedidos recibidos.
- Estados de preparación y entrega.
- Depósito viendo pedidos apenas son cargados.
- Historial de cambios y responsables.
- Notificaciones internas.
- Menos dependencia de boletas físicas y mensajes manuales.

## Horizonte 4 — Operación comercial

- Stock de depósito.
- Reserva o descuento de stock al confirmar pedidos.
- Cuentas corrientes y condiciones comerciales.
- Facturación y emisión de comprobantes.
- Impresión de boletas.
- Preparación y despacho.
- Integración futura con sistemas contables o fiscales, según el país.

## Horizonte 5 — Inteligencia comercial

- Sugerencias de reposición.
- Detección de pedidos inusuales.
- Comercios sin visitar.
- Evolución de ventas.
- Productos con baja rotación.
- Resúmenes accionables, no solo gráficos.

## Horizonte 5 — Producto profesional y comercializable

- Cuentas y perfiles.
- Sincronización segura.
- Equipos y permisos.
- Respaldo remoto.
- Suscripciones o planes.
- Panel para distribuidoras.
- Soporte, onboarding y documentación.

## Orden de decisión

Antes de desarrollar cualquier horizonte debemos responder:

1. ¿Qué usuario lo necesita?
2. ¿Qué problema concreto resuelve?
3. ¿Cuánto tiempo o error ahorra?
4. ¿Qué datos necesita?
5. ¿Cómo se prueba?
6. ¿Qué riesgo agrega?
7. ¿Puede convertirse en una ventaja por la que alguien pague?


---

# DOCUMENTO: TASKS.md

# VendeFrío — Tareas de coordinación

## Bloque actual: definición, sin implementación

### Decisiones ya orientadas

- [x] Público general: distribuidoras y empresas que venden y reparten productos.
- [x] Usuarios: preventistas, corredores, encargados, depósito, reparto y administración.
- [x] Problema central: reemplazar anotaciones, mensajes manuales y boletas físicas por un flujo digital compartido.
- [x] Visión futura: que un pedido cargado por cualquier integrante pueda ser visto y preparado por otra persona de la empresa.
- [x] Expansión prevista: stock, facturación, impresión, cuentas y múltiples usuarios.

### Pendientes de decisión

- [ ] Aprobar la visión completa.
- [ ] Revisar y aprobar `STRATEGIC_BRIEF.md`.
- [x] Elegir el primer segmento comercial concreto: distribuidoras pequeñas, medianas y mayoristas de barrio.
- [ ] Definir los tres problemas de mayor valor.
- [x] Definir la propuesta de valor en una frase.
- [x] Definir el flujo mínimo vendedor → depósito.
- [x] Definir los estados imprescindibles del flujo inicial.
- [x] Definir checklist de preparación y manejo de faltantes.
- [x] Definir sincronización pendiente cuando vuelve internet.
- [x] Definir entrega con confirmación manual y foto opcional de transferencia.
- [x] Definir comprobante simple futuro, no necesariamente factura fiscal.
- [x] Registrar visión futura de stock visible y comprometido al tomar pedidos.
- [ ] Definir diferencia entre stock físico, reservado y disponible.
- [ ] Definir qué funciones son esenciales y cuáles son secundarias.
- [ ] Definir qué podría justificar un pago.
- [ ] Aprobar el equipo final.
- [ ] Aprobar el protocolo de agentes.
- [ ] Aprobar el primer bloque de producto.

## Reglas para nuevas tareas

Toda tarea debe incluir:

- Problema.
- Usuario afectado.
- Resultado esperado.
- Archivos o áreas involucradas.
- Riesgos.
- Criterios de aceptación.
- Responsable.
- Estado.

## Prohibido por ahora

- Iniciar otra fase visual.
- Pedir cambios de código a Claude sin brief aprobado.
- Agregar funciones solo porque parecen modernas.
- Cambiar la tecnología base.
- Mezclar propuestas de agentes sin una decisión consolidada.


---

# DOCUMENTO: CHANGELOG.md

# VendeFrío — Registro de decisiones y cambios

## 2026-09-09 — Visión futura de stock conectado

- Se registra que quien toma pedidos debe poder consultar el stock real desde la calle.
- Se define como objetivo reservar o descontar cantidades al confirmar pedidos para no comprometer dos veces la misma mercadería.
- Se incorpora la planificación de carga desde fábrica para evitar viajes y gastos innecesarios.
- Se distingue como decisión futura el stock físico, reservado y disponible.

## 2026-09-09 — Definición del flujo operativo con el usuario

- Se priorizan distribuidoras pequeñas, medianas y mayoristas de barrio.
- Todos los usuarios autorizados compartirán el mismo centro de información y verán los mismos datos.
- Se elimina “pedido recibido” del flujo inicial porque la preparación ocurre cuando el equipo vuelve al depósito.
- Se define guardado local y sincronización automática al recuperar internet.
- Se define checklist por producto durante la preparación.
- Los faltantes se ajustan con observación y aviso al responsable económico.
- La entrega se confirma manualmente y puede incluir foto del comprobante de transferencia.
- La impresión futura será de comprobantes simples; la factura fiscal queda fuera del alcance inicial.

## 2026-09-09 — Definición del flujo operativo

- Se define que cada pedido tendrá seguimiento por estados.
- Se establece el ciclo: cargado, recibido, a preparar, en preparación, preparado, en reparto, entregado o con incidencia.
- Se define una futura bandeja organizada por etapas.
- Se incorpora como objetivo futuro conectar el pedido con stock, facturación, impresión y comprobantes.

## 2026-09-09 — Definición del problema comercial

- Se establece que VendeFrío apunta a distribuidoras y empresas que venden y reparten productos a comercios.
- Se incorporan como usuarios al vendedor, encargado, depósito, reparto y administración.
- Se define como problema central la dependencia de cuadernos, menús, mensajes manuales y boletas físicas.
- Se define como visión futura el flujo vendedor → pedido compartido → depósito → preparación → reparto.
- Se incorporan como expansión prevista stock, facturación, impresión, cuentas, roles y múltiples usuarios.

## 2026-09-09 — Inicio de etapa estratégica

- Se pausa el desarrollo técnico.
- Se descarta seguir improvisando fases aisladas.
- Se define como ambición una app profesional para preventistas, corredores, tomadores de pedidos y repartidores.
- Se establece que la app debe poder justificar un pago por el valor que aporta.
- Se define GitHub como fuente de verdad y Vercel como zona de prueba.
- Se establece un único modificador del código principal por vez.
- Se crea el protocolo común de agentes.
- Se crea el equipo de trabajo y la división de responsabilidades.
- Se crea la visión de producto.
- Se crea el roadmap estratégico.
- Se crea el estado inicial y la lista de decisiones pendientes.

## Decisiones anteriores conservadas

- Se mantiene la base actual en HTML, CSS y JavaScript puro.
- Se mantiene la PWA.
- Se mantiene `localStorage` mientras no se apruebe una arquitectura compartida.
- Se preservan las funciones actuales y los datos existentes.
- Se conserva la dirección nativa iniciada por Claude: SVG propios, bottom sheets, toasts, transiciones, safe areas y háptica.


---

# DOCUMENTO: ORDER_LIFECYCLE.md

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


---

# DOCUMENTO: STRATEGIC_BRIEF.md

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


---

# DOCUMENTO: USER_DECISIONS_ROUND1.md

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


---

# DOCUMENTO: AGENT_ASSIGNMENTS.md

# VendeFrío — Primera ronda de trabajo del equipo

**Estado:** Preparación estratégica. Nadie modifica código.

## Objetivo común de esta ronda

Analizar cómo convertir VendeFrío en una plataforma profesional para distribuidoras, centrada en el flujo vendedor → depósito → reparto → entrega.

Cada agente debe trabajar sobre `PRODUCT_VISION.md`, `PROJECT_STATE.md`, `ORDER_LIFECYCLE.md` y `STRATEGIC_BRIEF.md`.

## Entrega 1 — Zapia / coordinación

Consolidar las respuestas de todos los agentes en:

- Una propuesta de producto única.
- Tres problemas prioritarios.
- Flujo mínimo compartido.
- Estados iniciales del pedido.
- Riesgos principales.
- Próxima decisión del equipo.

No mezclar propuestas incompatibles sin resolver la contradicción.

## Entrega 2 — Agente analítico de producto

Analizar una distribuidora real y responder:

1. ¿Qué tareas ocurren desde que se toma el pedido hasta que se entrega?
2. ¿Dónde se pierde más tiempo?
3. ¿Dónde aparecen más errores?
4. ¿Qué información necesita el depósito?
5. ¿Qué información necesita reparto?
6. ¿Qué función justificaría un pago mensual?
7. ¿Cuál sería el flujo mínimo que ya aportaría valor?

Entregar prioridades ordenadas por impacto y frecuencia.

## Entrega 3 — Agente de experiencia y UX

Diseñar conceptualmente:

- Inicio de vendedor.
- Bandeja de pedidos.
- Detalle y tracking del pedido.
- Vista de depósito.
- Cambio de estados.
- Incidencias.
- Uso con una mano.
- Estados vacíos, carga y error.

No diseñar pantallas decorativas sin explicar qué tarea resuelven.

## Entrega 4 — Gemini / exploración visual

Proponer el lenguaje visual de una plataforma profesional para trabajo de campo y depósito:

- Jerarquía de estados.
- Colores para seguimiento.
- Tarjetas de pedido.
- Línea de tiempo.
- Indicadores de urgencia.
- Íconos.
- Lectura rápida bajo mala iluminación.
- Modo claro y oscuro.

Entregar referencias y reglas, no código.

## Entrega 5 — Generador visual

Crear referencias visuales únicamente para:

- Identidad de VendeFrío.
- Ilustración de operación logística.
- Estados de pedido.
- Recursos de onboarding.
- Posibles imágenes para presentación comercial.

No generar interfaces finales con texto ilegible. Los iconos funcionales serán SVG revisados e integrados por Claude.

## Entrega 6 — Agente crítico

Intentar romper la propuesta:

- ¿Es demasiado ambiciosa?
- ¿Qué parte no funcionaría con mala conexión?
- ¿Qué pasa si dos personas modifican un pedido?
- ¿Qué ocurre con faltantes?
- ¿Qué diferencia hay entre pedido, remito y factura?
- ¿Qué problemas legales o de operación puede haber con facturación?
- ¿Qué función parece atractiva pero no aporta valor?

Por cada crítica, proponer una solución o una decisión pendiente.

## Entrega 7 — QA

Crear una matriz inicial de pruebas para:

- Carga del pedido.
- Recepción por depósito.
- Preparación.
- Cambio de estado.
- Modificación.
- Faltante.
- Cancelación.
- Entrega parcial.
- Entrega final.
- Falta de conexión.
- Dos usuarios trabajando sobre el mismo pedido.
- Recuperación de datos.

Todavía no ejecutar pruebas de código: definir qué deberá probarse.

## Entrega 8 — Claude / ingeniería

En esta ronda no programar.

Revisar el brief desde el punto de vista técnico y reportar:

- Qué partes de la arquitectura actual sirven.
- Qué partes de `localStorage` no alcanzarán para cuentas compartidas.
- Qué datos debería tener un pedido.
- Qué cambios futuros conviene preparar sin implementarlos.
- Qué riesgos tendría una sincronización remota.
- Qué decisiones deben cerrarse antes de tocar código.

No modificar archivos del repositorio hasta recibir una tarea aprobada.

## Formato obligatorio de cada entrega

- Objetivo.
- Supuestos.
- Hallazgos.
- Recomendación principal.
- Alternativas.
- Riesgos.
- Criterios de aceptación.
- Decisiones que necesita el equipo.


---

# DOCUMENTO: AGENT_PROMPTS.md

# VendeFrío — Prompts iniciales para el equipo

## Prompt maestro común

> Formás parte del equipo de VendeFrío. Es una PWA móvil para preventistas, corredores, tomadores de pedidos, personal de depósito, repartidores y administración. Queremos convertirla en una herramienta profesional, rápida, confiable y suficientemente valiosa como para que una empresa distribuidora considere pagar por ella.
>
> El concepto central es que un pedido se cargue una sola vez y pueda seguirse por toda la operación: pedido cargado, recibido, a preparar, en preparación, preparado, en reparto, entregado o con incidencia. El equipo debe poder saber dónde está cada pedido, quién lo tiene y qué falta para completarlo.
>
> En el futuro, el mismo pedido deberá poder alimentar stock, facturación, impresión de boletas, cuentas corrientes, rutas y comprobantes de entrega.
>
> Queremos una experiencia clara de seguimiento, parecida a la claridad de un tracking de Mercado Libre, pero diseñada para una distribuidora.
>
> La fuente de verdad es GitHub: `EscabCodex/vendefrio-v2`, branch `main`. Vercel se usa para probar. La tecnología actual es HTML, CSS y JavaScript puro con `localStorage`.
>
> No modifiques código salvo autorización explícita. No inventes el estado del proyecto. Protegé las funciones y datos existentes. Trabajá como integrante de un equipo: separá hechos, opiniones y propuestas; indicá riesgos, dependencias y criterios de aceptación. Entregá una recomendación principal y no una lista interminable de ideas.
>
> Usá este formato: Objetivo, Observaciones, Recomendación principal, Alternativas, Riesgos, Criterios de aceptación y Próximo paso.

## Prompt para Claude

> Sos el ingeniero principal de VendeFrío. Solo implementás tareas que hayan sido aprobadas por Zapia y deben incluir problema, alcance, archivos, riesgos y criterios de aceptación. Trabajá sobre la versión actual de GitHub. Entregá siempre los archivos completos modificados, nunca fragmentos incompletos. No rompas datos de `localStorage`, navegación, pedidos, catálogo, comercios, historial, rutas, mapas ni PWA. Antes de entregar, probá claro, oscuro, celular, consola, navegación y regresiones relacionadas. Informá exactamente qué cambiaste, qué no cambiaste y qué quedó pendiente.

## Prompt para Gemini

> Sos el especialista de exploración visual y conceptual. Investigá cómo una app profesional de trabajo puede verse y sentirse clara, rápida y confiable. Proponé referencias, jerarquías, componentes, iconografía e ilustraciones que sirvan para VendeFrío. No diseñes por decoración: justificá cada decisión por utilidad, lectura y uso con una mano. No modifiques código. Entregá propuestas comparables y una recomendación principal.

## Prompt para Leonardo u otro generador visual

> Sos el especialista en recursos visuales de VendeFrío. Generá solamente imágenes o ilustraciones que puedan mejorar la comprensión, identidad o percepción profesional del producto. Priorizá consistencia, legibilidad, fondo controlable y posibilidad de adaptación a una interfaz móvil. No generes texto ilegible ni assets que deban funcionar como lógica de interfaz. Entregá prompts reutilizables, variantes y advertencias de uso. Todo recurso debe ser revisado antes de incorporarse.

## Prompt para el agente analítico

> Sos el especialista en producto y experiencia de usuario. Analizá VendeFrío desde el trabajo real de un preventista, corredor, tomador de pedidos o repartidor. Buscá tiempo perdido, errores, datos faltantes, pasos repetidos y oportunidades por las que alguien pagaría. Priorizá por impacto, frecuencia, esfuerzo y riesgo. No pidas cambios de código. Entregá problemas ordenados, solución recomendada y criterios medibles.

## Prompt para el agente crítico

> Sos la segunda opinión independiente de VendeFrío. Tu trabajo es cuestionar propuestas antes de implementarlas. Buscá contradicciones, complejidad innecesaria, riesgos técnicos, mala experiencia móvil, funciones sin valor y decisiones que parezcan poco profesionales. No critiques de forma vaga: por cada problema proponé una alternativa concreta y explicá qué debería comprobarse.

## Prompt para QA

> Sos responsable de calidad de VendeFrío. Convertí cada propuesta aprobada en casos de prueba claros. Cubrí flujo normal, datos vacíos, datos antiguos, errores, modo oscuro, celular, PWA, offline, localStorage, navegación y regresiones. No declares una tarea correcta por verla una vez: indicá pasos, resultado esperado y severidad de cada fallo.


---

# DOCUMENTO: AGENT_MESSAGES_READY.md

# Mensajes listos para enviar a cada agente

## Texto general para acompañar el archivo maestro

Te adjunto `VENDEFRIO_MASTER_BRIEF.md`. Este archivo reúne toda la documentación oficial actual del proyecto: visión, usuarios, flujo de pedidos, stock futuro, equipo, reglas de trabajo, decisiones tomadas y asignación de tareas. Leelo completo antes de responder. No inventes información ni modifiques código todavía. Si algo no está definido, señalalo como pregunta o propuesta.

## Claude — Ingeniería y arquitectura

Hola Claude. Estamos reorganizando VendeFrío como un proyecto de producto profesional para distribuidoras y empresas que venden y reparten productos a almacenes, kioscos y supermercados.

Antes de responder, leé todos los archivos `.md` de la raíz del repositorio `EscabCodex/vendefrio-v2`. Son la documentación oficial del proyecto. Prestá especial atención a `PRODUCT_VISION.md`, `PROJECT_STATE.md`, `TEAM.md`, `AGENT_PROTOCOL.md`, `ORDER_LIFECYCLE.md`, `STRATEGIC_BRIEF.md` y `AGENT_ASSIGNMENTS.md`.

Tu rol es ser el ingeniero principal. En esta primera ronda no programes ni modifiques archivos. Analizá:

1. Qué partes de la arquitectura actual sirven para crecer.
2. Qué límites tiene `localStorage` para cuentas compartidas.
3. Qué datos debería tener cada pedido para permitir seguimiento.
4. Qué roles y permisos habrá que contemplar.
5. Qué cambios futuros conviene preparar sin implementarlos.
6. Qué riesgos tiene una futura sincronización remota.
7. Qué decisiones debemos cerrar antes de tocar código.

Recordá que el concepto central es: un pedido se carga una vez y sigue el recorrido cargado → recibido → a preparar → en preparación → preparado → en reparto → entregado, con incidencias cuando corresponda.

Entregá tu análisis con este formato: Objetivo, Observaciones, Recomendación principal, Alternativas, Riesgos, Criterios de aceptación y Próximo paso. No entregues código todavía.

---

## Gemini — Producto visual y experiencia

Hola Gemini. Estamos reorganizando VendeFrío como una plataforma profesional para distribuidoras. Antes de responder, leé todos los archivos `.md` de la raíz del repositorio `EscabCodex/vendefrio-v2`, especialmente `PRODUCT_VISION.md`, `STRATEGIC_BRIEF.md`, `ORDER_LIFECYCLE.md`, `TEAM.md` y `AGENT_PROTOCOL.md`.

Tu rol es explorar cómo debería verse y sentirse una aplicación profesional usada por preventistas, personal de depósito, repartidores y encargados.

Analizá y proponé:

1. Lenguaje visual general.
2. Jerarquía de los estados de pedido.
3. Diseño conceptual de tarjetas y lista de pedidos.
4. Línea de seguimiento tipo tracking.
5. Colores para cargado, preparación, preparado, reparto, entregado e incidencia.
6. Indicadores de urgencia o demora.
7. Iconografía consistente.
8. Uso con una mano.
9. Lectura rápida bajo mala iluminación.
10. Modo claro y oscuro.

No modifiques código. No propongas decoración sin utilidad. Entregá alternativas comparables, una recomendación principal, riesgos y criterios de aceptación.

---

## Agente analítico — Producto y negocio

Hola. Estamos diseñando VendeFrío como una plataforma para distribuidoras y empresas que venden productos a almacenes, kioscos y supermercados.

Antes de responder, leé todos los archivos `.md` de la raíz del repositorio `EscabCodex/vendefrio-v2`. Son la documentación oficial del proyecto.

Tu misión es analizar el trabajo real de una distribuidora y detectar dónde VendeFrío puede aportar valor suficiente para justificar un pago.

Respondé:

1. Qué ocurre desde que un vendedor toma un pedido hasta que se entrega.
2. Dónde se pierde más tiempo.
3. Dónde se cometen más errores.
4. Qué necesita saber el depósito.
5. Qué necesita saber reparto.
6. Qué necesita saber administración.
7. Qué información debe quedar registrada.
8. Qué problema debería resolverse primero.
9. Qué tres funciones tendrían mayor impacto.
10. Qué función justificaría un pago mensual.

Priorizá por impacto, frecuencia, ahorro de tiempo, reducción de errores y dificultad de implementación. No pidas cambios de código. Entregá una única recomendación principal y criterios medibles.

---

## Agente crítico — Segunda opinión

Hola. Necesitamos que seas la segunda opinión independiente de VendeFrío.

Antes de responder, leé todos los archivos `.md` de la raíz del repositorio `EscabCodex/vendefrio-v2`, especialmente `STRATEGIC_BRIEF.md`, `ORDER_LIFECYCLE.md`, `PROJECT_STATE.md` y `AGENT_PROTOCOL.md`.

Intentá encontrar problemas en la propuesta de convertir VendeFrío en una plataforma compartida para distribuidoras.

Analizá especialmente:

1. Qué parte puede ser demasiado ambiciosa.
2. Qué pasa con mala conexión.
3. Qué ocurre si dos personas modifican un pedido.
4. Cómo se manejan faltantes y entregas parciales.
5. Qué diferencia debe haber entre pedido, remito, factura y comprobante.
6. Qué riesgos aparecen con impresión y facturación.
7. Qué funciones podrían parecer modernas pero no aportar valor.
8. Qué podría hacer que una empresa no quiera pagar.
9. Qué problema de seguridad o permisos podría aparecer.
10. Qué deberíamos simplificar.

No critiques de forma vaga. Por cada problema proponé una alternativa concreta o una decisión pendiente.

---

## Generador visual — Leonardo u otro

Hola. Estamos creando VendeFrío, una plataforma profesional para distribuidoras, preventistas, depósitos y repartidores.

Antes de generar propuestas, leé `PRODUCT_VISION.md`, `STRATEGIC_BRIEF.md`, `ORDER_LIFECYCLE.md` y `AGENT_PROTOCOL.md` en la raíz del repositorio `EscabCodex/vendefrio-v2`.

Generá referencias visuales para:

1. Identidad profesional de VendeFrío.
2. Operación de una distribuidora.
3. Recorrido de un pedido.
4. Estados de preparación y reparto.
5. Ilustraciones de onboarding.
6. Presentación comercial del producto.

Priorizá consistencia, claridad, aspecto profesional y posibilidad de adaptación a una interfaz móvil. No generes interfaces finales con texto ilegible. No generes iconos funcionales como producto final: esos serán convertidos a SVG limpio después de ser aprobados.

Entregá prompts reutilizables, variantes, relación de aspecto recomendada, estilo visual y advertencias de uso.

---

## QA — Calidad y pruebas

Hola. Estamos preparando VendeFrío para convertirse en una plataforma profesional de distribuidoras.

Antes de trabajar, leé todos los archivos `.md` de la raíz del repositorio `EscabCodex/vendefrio-v2`, especialmente `ORDER_LIFECYCLE.md`, `STRATEGIC_BRIEF.md`, `PROJECT_STATE.md` y `AGENT_PROTOCOL.md`.

En esta primera ronda no ejecutes pruebas de código. Prepará una matriz de calidad para el futuro flujo compartido:

1. Carga de pedido.
2. Recepción por depósito.
3. Pedido a preparar.
4. En preparación.
5. Pedido preparado.
6. Salida a reparto.
7. Entrega.
8. Incidencia.
9. Faltantes.
10. Entrega parcial.
11. Cancelación.
12. Modificación después de cargar.
13. Dos usuarios trabajando sobre el mismo pedido.
14. Falta de conexión.
15. Recuperación de datos.
16. Permisos según rol.
17. Facturación e impresión futura.

Para cada caso indicá pasos, resultado esperado, datos necesarios, severidad y riesgo de regresión. No declares una función correcta solo porque se vea bien una vez.


---

# DOCUMENTO: FOLLOWUP_MESSAGES_ROUND1.md

# VendeFrío — Mensajes de seguimiento, ronda 1

## Mensaje general para acompañar el archivo maestro

Te adjunto `VENDEFRIO_MASTER_BRIEF.md`. Este archivo reúne toda la documentación oficial actual del proyecto: visión, usuarios, flujo de pedidos, stock futuro, equipo, reglas de trabajo, decisiones tomadas y asignación de tareas. Leelo completo antes de responder. No inventes información ni modifiques código todavía. Si algo no está definido, señalalo como pregunta o propuesta.

## Mensaje para Claude

Claude, ya revisamos tu análisis y tomamos decisiones concretas sobre cómo funciona la distribuidora. Leé también `USER_DECISIONS_ROUND1.md` y la versión actual de `VENDEFRIO_MASTER_BRIEF.md`.

Estas son las decisiones confirmadas:

- El público inicial son distribuidoras pequeñas, medianas y mayoristas de barrio.
- Una misma cuenta representa a toda la distribuidora.
- Todos los usuarios autorizados ven los mismos datos en la primera versión.
- El pedido puede guardarse sin internet y sincronizarse automáticamente cuando vuelva la conexión.
- No hace falta un estado separado de “pedido recibido”.
- El flujo inicial es: ingresado → en preparación → preparado → cargado en vehículo → en reparto → entregado.
- La preparación será una checklist por producto.
- Si faltan unidades, se ajusta la cantidad preparada, se agrega observación y se avisa al responsable económico.
- La entrega se confirma con “Marcar como entregado” y puede incluir una foto del comprobante de transferencia.
- La impresión futura será de comprobantes simples; la factura fiscal queda fuera del primer alcance.
- En el futuro, quien toma pedidos debe poder consultar stock disponible y comprometer cantidades para evitar vender mercadería inexistente.

Ahora necesitamos una segunda devolución técnica, todavía sin programar:

1. Explicá qué significa en la práctica pasar de datos locales en un celular a datos compartidos.
2. Proponé una evolución por etapas, sin obligarnos a construir todo de una vez.
3. Indicá qué estructura mínima debería tener un pedido y su historial de estados.
4. Explicá cómo guardar pedidos sin conexión y sincronizarlos después, en palabras comprensibles.
5. Señalá qué decisiones técnicas son urgentes y cuáles pueden esperar.
6. Indicá qué parte de la arquitectura actual conviene conservar.
7. Explicá riesgos de que dos personas trabajen sobre el mismo pedido.
8. Proponé una primera etapa técnica realista para una distribuidora chica o mediana.

No modifiques código ni entregues archivos. Queremos entender la estrategia antes de implementar.

Usá ejemplos concretos de nuestra operación, no ejemplos de una empresa multinacional.

---

## Mensaje para Gemini

Gemini, gracias por tu propuesta visual. Ya tomamos decisiones concretas sobre la operación real. Leé `USER_DECISIONS_ROUND1.md` y la versión actual de `VENDEFRIO_MASTER_BRIEF.md`.

Ajustá tu propuesta teniendo en cuenta:

- El público inicial son distribuidoras pequeñas, medianas y mayoristas de barrio.
- No apuntamos todavía a una empresa grande ni a una torre de control industrial.
- Durante el día se toman pedidos y luego se vuelve al depósito a prepararlos.
- No hace falta que haya alguien esperando pedidos en el depósito en tiempo real.
- Si no hay internet, el pedido se guarda y se sincroniza después.
- Todos los usuarios autorizados comparten la misma información.
- El flujo es: pedido ingresado → en preparación → preparado → cargado en vehículo → en reparto → entregado.
- La preparación necesita una checklist por producto.
- Los faltantes se ajustan con observación y aviso al responsable económico.
- La entrega se confirma con un botón y puede tener foto del comprobante de transferencia.
- La cadena de frío, palets, ventanas horarias estrictas y bultos deben tratarse como posibilidades, no como supuestos obligatorios.

Ahora revisá tu propuesta y entregá:

1. La estructura más clara para la pantalla de pedidos.
2. La mejor forma de mostrar la checklist de preparación.
3. La línea de seguimiento del pedido.
4. Qué información debería aparecer en la tarjeta resumida.
5. Qué acciones debería poder hacer cada persona sin complicar la primera versión.
6. Qué elementos de tu propuesta inicial son demasiado avanzados para este primer segmento.
7. Una recomendación visual realista para una distribuidora chica o mediana.

No propongas código ni cambios de archivos. No uses “picking”, “SLA”, “torre de control” u otros términos sin explicarlos. No diseñes una interfaz de empresa multinacional: diseñá una herramienta clara para un equipo pequeño que trabaja desde celulares.
