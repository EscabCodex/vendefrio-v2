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
