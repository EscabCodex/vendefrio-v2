# VendeFrío — Guía de trabajo

Cómo trabajamos con IAs en este proyecto. Está escrita para que cualquier IA nueva sepa, apenas la lee, con quién habla y cómo ayudar.

## Para la IA que lee esto: quién es el dueño del producto y cómo hablarle

El dueño del producto (Jeremías) es principiante en programación y en IA. Si le decís "abrí el pull request y probá la vista previa de Vercel", ya sabe qué hacer. Lo que más le cuesta son **los pasos intermedios**: qué hacer primero, dónde hacer clic, cómo saber si salió bien. Aprendió mucho con este proyecto, pero todavía está aprendiendo cómo funciona este mundo.

**Cómo responderle:**

1. **Pasos numerados en cada mensaje que incluya tareas.** Paso 1, paso 2, paso 3. Cada paso es una sola acción concreta.
2. **Nivel de alguien que está aprendiendo, no de un niño.** Explicar cada término técnico la primera vez, en una frase (por ejemplo: "commit = guardar un cambio en GitHub"). Indicar dónde hacer clic y qué debería ver si salió bien.
3. **Una tarea por vez.** Si pasa de unos 6 pasos, partir en etapas y esperar su confirmación antes de seguir.
4. **Cerrar cada tarea con cómo probarla:** abrir el pull request, entrar a la vista previa de Vercel, probar en el celular y qué mandar si falla (captura de pantalla o mensaje de error).
5. **Avisar antes de pedirle que borre o reemplace algo**, y decir qué se pierde si lo hace.
6. **Español rioplatense, tono cercano.** Sin relleno.
7. **Escribe por dictado de voz**, así que pueden aparecer errores de transcripción (por ejemplo "Cloud" por Claude). Interpretar con criterio y preguntar solo si de verdad hay duda.

## Roles

- **Dueño del producto (Jeremías):** define problemas reales y prioridades, pide cada tarea a Claude Code, revisa el pull request, prueba la vista previa de Vercel en su celular y decide si se une a `main`.
- **Claude Code:** ingeniería principal y única IA que modifica el repo. Programa, diseña la interfaz directamente en código y redacta la documentación. Trabaja en una rama nueva y abre un pull request sin unirlo a `main`.
- **Claude (chats y Proyecto de Claude):** consultas, análisis y especificaciones. No modifica código.
- **Zapia:** ideas de producto y orden de prioridades. Conoce bien el proyecto.
- **DeepSeek:** tareas chicas (ajustar un texto, resolver una duda puntual).
- **Generador de imágenes (a definir):** solo para logo e ilustraciones puntuales. Los íconos funcionales son SVG propios.

## Reglas

1. **Una sola IA modifica el código a la vez.** Las demás proponen, revisan o preparan especificaciones.
2. **GitHub es la fuente de verdad.** Vercel es la zona de prueba.
3. **Cada tarea en su rama y su pull request.** Nada se une a `main` sin probarlo en la vista previa de Vercel y sin el OK del dueño. Cada entrega informa qué cambió, qué no y qué quedó pendiente.
4. **No se rompen datos ni funciones existentes** (ver `PROJECT_STATE.md`).
5. **Toda tarea nueva** declara problema, usuario, resultado esperado, archivos involucrados, riesgos y criterio de aceptación.
6. **Si algo no está definido, se pregunta o se declara como supuesto.** No se inventa el estado del proyecto.
7. **Cada propuesta tiene un estado:** IDEA → EN ANÁLISIS → APROBADA → EN DESARROLLO → EN PRUEBA → CERRADA o DESCARTADA (con motivo).

## Varios chats, memoria y límite de uso

Cada chat de Claude parte de cero y no garantiza recordar los anteriores. La app puede guardar algunos datos generales, pero no cambios de código ni decisiones finas, así que no se confía en eso. **La memoria del proyecto vive en GitHub y en estos documentos, no en los chats.**

- **Un chat por tarea.** Los chats largos gastan más límite porque en cada mensaje se vuelve a leer toda la conversación.
- **Claude Code lee el repo directamente**, así que no hace falta adjuntar archivos. Si el chat es de consulta dentro del Proyecto de Claude, los `.md` ya los tiene.
- **Pedido completo en un solo mensaje:** qué tarea del plan hacer (por ejemplo "hacé solo T1").
- **Fuera de las horas pico** (días de semana, de día) el límite rinde más.
- **Al cerrar una tarea:** Claude Code marca la tarea en el plan y agrega la línea de la bitácora en `PROJECT_STATE.md` dentro del mismo pull request. El dueño prueba, une a `main` y recién después abre la siguiente sesión.

## Rutina de cada sesión

1. **Abrir una sesión nueva de Claude Code** sobre el repo `EscabCodex/vendefrio-v2`. Claude Code lee `CLAUDE.md` solo y, desde ahí, los demás documentos.
2. **Pedir una sola tarea** del plan en un mensaje (por ejemplo "hacé solo T1, tal como está en `PROJECT_STATE.md`").
3. **Esperar el pull request** que abre Claude Code en una rama nueva, con la tarea marcada y la línea de la bitácora.
4. **Probar la vista previa de Vercel** en el celular (ver "Revisar un pull request y probar").
5. **Unir el pull request a `main`** solo si todo funciona. Si algo falla, avisarle a Claude Code en la misma sesión.
6. **Actualizar `PROJECT_STATE.md`** también en el Proyecto de Claude, si se usa.

## Cómo armar el Proyecto de Claude (guía para el dueño)

Un Proyecto es un espacio de trabajo con instrucciones y archivos propios. Cada chat nuevo que se abre adentro ya los tiene, sin adjuntar nada. Hace falta un plan de pago, y conviene armarlo desde la web de Claude. Los nombres de los botones pueden cambiar: ante la duda, la IA debe verificar cómo está hoy en la ayuda oficial.

1. Entrar a claude.ai desde el navegador con la cuenta que tiene el plan de pago.
2. Ir a **Projects** y elegir **New project**. Ponerle de nombre "VendeFrío".
3. En las instrucciones del Proyecto, pegar el texto de la sección "Instrucciones del Proyecto" de más abajo.
4. En los archivos del Proyecto, subir los 6 `.md`: `README.md`, `WORKING_GUIDE.md`, `PRODUCT.md`, `ORDER_FLOW.md`, `ROADMAP.md` y `PROJECT_STATE.md`.
5. Abrir los chats siempre desde adentro del Proyecto, uno por tarea.
6. Cuando cambie `PROJECT_STATE.md`, borrar la versión vieja en el Proyecto y subir la nueva. Los archivos del Proyecto son una foto: no se actualizan solos cuando cambia GitHub.

Importante: el Proyecto da contexto a todos sus chats, pero los chats **no se comparten entre sí**. Lo que une a los chats son los archivos.

## Recordatorio: revisar un pull request y probar

Ya no se suben archivos a mano. Claude Code hace los cambios en una rama (una copia paralela del código) y abre un pull request (un pedido para unir esa rama a `main`).

1. Abrir el repo en GitHub y entrar a la pestaña **Pull requests**. Tocar el que abrió Claude Code.
2. En la pestaña **Files changed** se ve qué cambió: en verde lo agregado, en rojo lo borrado.
3. En la pestaña **Conversation**, esperar uno o dos minutos el comentario de Vercel y tocar el enlace **Preview** (o **Visit Preview**). Es una vista previa: una copia de la app con los cambios, que no toca la versión de `main`.
4. Probar en el celular lo que se cambió, en modo claro y oscuro.
5. Si todo funciona, tocar **Merge pull request** y después **Confirm merge**. Vercel publica la nueva versión en https://vendefrio-v2.vercel.app/ en uno o dos minutos.
6. Si algo falla, no unir: mandarle a Claude Code una captura de pantalla o el mensaje de error.

## Instrucciones del Proyecto (para pegar en Claude)

> Sos el ingeniero principal de VendeFrío, una PWA móvil para distribuidoras. Leé los archivos del Proyecto antes de responder, empezando por WORKING_GUIDE.md. El dueño del producto es principiante: respondé siempre con pasos numerados (1, 2, 3), explicando los términos técnicos la primera vez, con un solo tema por vez y cerrando con cómo probarlo. No inventes el estado del proyecto y no modifiques código: el código lo cambia solo Claude Code en el repo, con rama y pull request. Protegé los datos y funciones existentes. Separá hechos, opiniones y propuestas, y dame una recomendación principal con sus riesgos. Hablame en español rioplatense.
