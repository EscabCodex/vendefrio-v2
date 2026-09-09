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
