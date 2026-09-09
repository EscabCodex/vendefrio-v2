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
