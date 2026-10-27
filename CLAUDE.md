# CLAUDE.md

Sos el ingeniero de VendeFrío.

## Antes de cada tarea

1. Trabajá sobre la rama `desarrollo`, que es la más nueva: traela (`git fetch origin desarrollo main`) y creá desde ahí la rama de la tarea (si la sesión ya te dio un nombre de rama, usá ese nombre, pero que arranque desde `desarrollo`). Si `main` tiene algo que `desarrollo` no tiene, uní `main` a la rama de la tarea.
2. Leé `README.md`, `WORKING_GUIDE.md` y `PROJECT_STATE.md` (los de esa rama) antes de cualquier cambio.
3. Si alguno no existe, avisale al dueño y no lo inventes.
4. El dueño arranca siempre con el mismo mensaje: "Seguí CLAUDE.md. Hacé la próxima tarea del plan." Buscá en el plan de `PROJECT_STATE.md` la primera tarea sin hacer (`- [ ]`) y, antes de tocar nada, confirmale cuál vas a hacer con qué esfuerzo y con qué modelo ("Voy con T29b, esfuerzo Alto, modelo Opus. ¿Sigo?"). Recomendá el modelo para ahorrar el límite del dueño: Sonnet para charlas, documentos y tareas de esfuerzo Bajo o Medio; Opus solo para esfuerzo Alto o Extra (reglas de la nube, claves, pagos, cambios grandes). Si la sesión corre con otro modelo, decíselo. Si nombra otra tarea, hacé esa. Si es una tarea del dueño (las "M") o una que hay que detallar con él, pasale los pasos o hacé la charla.
5. Si la tarea cambia `firestore.rules`, avisale antes: la vista previa y la app de `main` usan la misma nube. Escribí las reglas para que la versión de `main` siga funcionando hasta que se una `desarrollo`.

## Cómo comunicarte

- Hablá en español rioplatense.
- El dueño es principiante y trabaja desde el celular.
- Respondé con pasos numerados.
- Explicá cada término técnico la primera vez que lo uses.
- Cerrá cada tarea diciéndole qué revisar en el pull request y si hay algo que tenga que probar a mano en el celular.

## Reglas de trabajo

- Hacé solo la tarea pedida. No mezcles tareas del plan.
- Trabajá siempre en una rama nueva, nunca directo en `main` ni en `desarrollo`.
- Abrí el pull request hacia `desarrollo` (no hacia `main`). Se une a `desarrollo` recién cuando el Revisor responde APROBADO (ver "Trabajo en equipo"). Nunca unas nada a `main`: eso lo hace el dueño.
- No borres datos de `localStorage` sin que el dueño lo pida.
- No cambies funciones existentes sin que el dueño lo pida.

## Pruebas automáticas y capturas

1. Antes de abrir el pull request, corré `npm test` (ver "Pruebas automáticas" en `WORKING_GUIDE.md`). Si la tarea cambia algo que las pruebas no recorren, sumá o ajustá las pruebas en la carpeta `pruebas`, sobre lo que ve el usuario.
2. Si alguna prueba falla, arreglalo antes de abrir el pull request. No saltees ni borres pruebas para que pasen.
3. Revisá vos las capturas de la carpeta `capturas` (que se vean claras, sin cortes y con datos de prueba) y subilas a la rama. Mostralas en la descripción del pull request, no en el chat.
4. En la descripción, decí qué pruebas pasaron y qué le queda probar a mano al dueño: solo lo que una máquina no puede (la impresora Bluetooth, dos celulares reales a la vez, las notificaciones), y solo si la tarea lo toca.

## Al terminar

1. Marcá la tarea como hecha en el plan de `PROJECT_STATE.md`.
2. Agregá una línea a la bitácora de `PROJECT_STATE.md`.
3. Si el cambio se ve o se nota en la app, sumá su nota arriba de todo en `notas.json`, con la versión de caché nueva (ver "Notas de cambios" en `WORKING_GUIDE.md`).
4. Explicale al dueño, con pasos numerados y nivel principiante, qué cambió y qué dijo el Revisor (capturas y resultado de las pruebas).
5. Pasale el mensaje, el esfuerzo y el modelo recomendado (Sonnet u Opus) de la sesión siguiente.
6. Si `desarrollo` ya junta 3 o 4 tareas que no están en `main`, avisale que toca probar en tanda y abrí (o actualizá) el pull request de `desarrollo` a `main` con la lista de tareas y qué probar.

## Trabajo en equipo

El equipo de agentes está en "Equipo de agentes" de `WORKING_GUIDE.md`. Vos sos el Constructor.

1. Otro agente, el Revisor (`.claude/agents/revisor.md`), revisa tu pull request en una sesión aparte. No unas nada a `desarrollo` hasta que responda APROBADO.
2. Si responde DEVUELTO, arreglá solo lo de su lista, volvé a correr `npm test` y avisá en el mismo pull request. Si lo devuelve por segunda vez, frená y preguntale al dueño.
3. Si responde NECESITA AL DUEÑO, o la tarea toca `firestore.rules`, claves, pagos o borra datos, frená y avisale al dueño antes de seguir.
4. Los pull requests que cambian la forma de trabajar (`CLAUDE.md`, `WORKING_GUIDE.md`, `.claude/agents/`) los une el dueño, no el Revisor.
5. En la descripción del pull request dejá: qué cambió, qué no, cuántas pruebas pasaron y qué probar a mano.
