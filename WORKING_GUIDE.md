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

- **Dueño del producto (Jeremías):** define problemas reales y prioridades, pide cada tarea a Claude Code, revisa el pull request (capturas y pruebas) y lo une a `desarrollo`; cada 3 o 4 tareas prueba `desarrollo` en su celular y decide si se une a `main`.
- **Claude Code:** ingeniería principal y única IA que modifica el repo. Programa, diseña la interfaz directamente en código, corre las pruebas automáticas y redacta la documentación. Trabaja en una rama nueva y abre un pull request hacia `desarrollo` sin unirlo.
- **Claude (chats y Proyecto de Claude):** consultas, análisis y especificaciones. No modifica código.
- **Zapia:** ideas de producto y orden de prioridades. Conoce bien el proyecto.
- **DeepSeek:** tareas chicas (ajustar un texto, resolver una duda puntual).
- **Generador de imágenes (a definir):** solo para logo e ilustraciones puntuales. Los íconos funcionales son SVG propios.

## Reglas

1. **Una sola IA modifica el código a la vez.** Las demás proponen, revisan o preparan especificaciones.
2. **GitHub es la fuente de verdad.** Vercel es la zona de prueba.
3. **Cada tarea en su rama y su pull request hacia `desarrollo`.** Se une a `desarrollo` si pasan las pruebas automáticas y las capturas se ven bien. Nada se une a `main` sin probarlo en el celular y sin el OK del dueño (ver "Probar en tanda"). Cada entrega informa qué cambió, qué no y qué quedó pendiente.
4. **No se rompen datos ni funciones existentes** (ver `PROJECT_STATE.md`).
5. **Toda tarea nueva** declara problema, usuario, resultado esperado, archivos involucrados, riesgos y criterio de aceptación.
6. **Si algo no está definido, se pregunta o se declara como supuesto.** No se inventa el estado del proyecto.
7. **Cada propuesta tiene un estado:** IDEA → EN ANÁLISIS → APROBADA → EN DESARROLLO → EN PRUEBA → CERRADA o DESCARTADA (con motivo).

## Varios chats, memoria y límite de uso

Cada chat de Claude parte de cero y no garantiza recordar los anteriores. La app puede guardar algunos datos generales, pero no cambios de código ni decisiones finas, así que no se confía en eso. **La memoria del proyecto vive en GitHub y en estos documentos, no en los chats.**

- **Un chat por tarea.** Los chats largos gastan más límite porque en cada mensaje se vuelve a leer toda la conversación.
- **Claude Code lee el repo directamente**, así que no hace falta adjuntar archivos. Si el chat es de consulta dentro del Proyecto de Claude, los `.md` ya los tiene.
- **Siempre el mismo mensaje:** "Seguí CLAUDE.md. Hacé la próxima tarea del plan." Claude Code busca en el plan la primera tarea sin hacer. Si alguna vez querés otra, nombrala (por ejemplo "Seguí CLAUDE.md. Hacé solo T29c.").
- **Fuera de las horas pico** (días de semana, de día) el límite rinde más.
- **Al cerrar una tarea:** Claude Code marca la tarea en el plan y agrega la línea de la bitácora en `PROJECT_STATE.md` dentro del mismo pull request, y le pasa al dueño el mensaje y el esfuerzo de la sesión siguiente. El dueño une el pull request a `desarrollo` y recién después abre la siguiente sesión.

## Rutina de cada sesión

1. **Abrir una sesión nueva de Claude Code** sobre el repo `EscabCodex/vendefrio-v2`. Claude Code lee `CLAUDE.md` solo y, desde ahí, los demás documentos.
2. **Elegir el esfuerzo** de la sesión (Medio, Alto o Extra): el que te pasó Claude Code al terminar la sesión anterior (también figura en cada tarea del plan).
3. **Mandar siempre el mismo mensaje:** "Seguí CLAUDE.md. Hacé la próxima tarea del plan."
4. **Confirmar:** Claude Code contesta qué tarea va a hacer y con qué esfuerzo (por ejemplo "Voy con T29b, esfuerzo Alto. ¿Sigo?"). Si no coincide con el esfuerzo que elegiste, cambialo en la sesión. Después contestá "Sí".
5. **Esperar el pull request** que abre Claude Code hacia `desarrollo`, con la tarea marcada, la línea de la bitácora, el resultado de las pruebas automáticas y las capturas.
6. **Revisarlo y unirlo a `desarrollo`** (ver "Revisar un pull request"). Probar a mano en el celular solo si el pull request lo pide.
7. **Cada 3 o 4 tareas, probar en tanda** y unir `desarrollo` a `main` (ver "Probar en tanda").
8. **Actualizar `PROJECT_STATE.md`** también en el Proyecto de Claude, si se usa.

## Cómo armar el Proyecto de Claude (guía para el dueño)

Un Proyecto es un espacio de trabajo con instrucciones y archivos propios. Cada chat nuevo que se abre adentro ya los tiene, sin adjuntar nada. Hace falta un plan de pago, y conviene armarlo desde la web de Claude. Los nombres de los botones pueden cambiar: ante la duda, la IA debe verificar cómo está hoy en la ayuda oficial.

1. Entrar a claude.ai desde el navegador con la cuenta que tiene el plan de pago.
2. Ir a **Projects** y elegir **New project**. Ponerle de nombre "VendeFrío".
3. En las instrucciones del Proyecto, pegar el texto de la sección "Instrucciones del Proyecto" de más abajo.
4. En los archivos del Proyecto, subir los 6 `.md`: `README.md`, `WORKING_GUIDE.md`, `PRODUCT.md`, `ORDER_FLOW.md`, `ROADMAP.md` y `PROJECT_STATE.md`.
5. Abrir los chats siempre desde adentro del Proyecto, uno por tarea.
6. Cuando cambie `PROJECT_STATE.md`, borrar la versión vieja en el Proyecto y subir la nueva. Los archivos del Proyecto son una foto: no se actualizan solos cuando cambia GitHub.

Importante: el Proyecto da contexto a todos sus chats, pero los chats **no se comparten entre sí**. Lo que une a los chats son los archivos.

## Las ramas

Una rama es una copia paralela del código.

- **`main`:** la app que usa el equipo (https://vendefrio-v2.vercel.app/). Nunca recibe nada sin que lo pruebes en el celular.
- **`desarrollo`:** junta las tareas terminadas que todavía no probaste a mano. Vercel le da una dirección fija: https://vendefrio-v2-git-desarrollo-escab-codex.vercel.app/
- **La rama de cada tarea:** la crea Claude Code desde `desarrollo` y abre un pull request (un pedido para unir esa rama a `desarrollo`).

## Revisar un pull request

Ya no se suben archivos a mano ni se prueba cada tarea en el celular: Claude Code corre las pruebas automáticas antes de abrir el pull request.

1. Abrir el repo en GitHub y entrar a la pestaña **Pull requests**. Tocar el que abrió Claude Code. Arriba tiene que decir que va a `desarrollo` ("wants to merge … into `desarrollo`").
2. En la pestaña **Conversation**, leer la descripción: qué cambió, el resultado de las pruebas (por ejemplo "4 de 4 pasaron") y las capturas, en modo claro y oscuro. Mirar que las pantallas se vean bien.
3. Si la descripción dice "Probar a mano" (por ejemplo, con la impresora o con dos celulares), entrar a la vista previa: esperar uno o dos minutos el comentario de Vercel y tocar **Preview** (o **Visit Preview**). Ojo: la vista previa usa la misma nube que la app publicada. Entrar con la cuenta de prueba (la distribuidora "PRUEBA"), no con la real.
4. Si todo está bien, tocar **Merge pull request** y después **Confirm merge**. Esto une la tarea a `desarrollo`: la app del equipo (`main`) todavía no cambia.
5. Si algo se ve mal o falla, no unir: mandarle a Claude Code una captura de pantalla o el mensaje de error, en la misma sesión.

## Probar en tanda (cada 3 o 4 tareas)

Cuando `desarrollo` junta 3 o 4 tareas, Claude Code te avisa y abre un pull request de `desarrollo` a `main` con la lista de tareas y qué probar.

1. Abrir en el celular la dirección fija de `desarrollo`: https://vendefrio-v2-git-desarrollo-escab-codex.vercel.app/ (con la cuenta de prueba, como en cualquier vista previa).
2. Probar lo que dice ese pull request, en modo claro y oscuro.
3. Si anda todo, entrar a ese pull request en GitHub y tocar **Merge pull request** y **Confirm merge** (no elegir "Squash and merge" ni "Rebase and merge": así `desarrollo` y `main` quedan iguales). Vercel publica la nueva versión en https://vendefrio-v2.vercel.app/ en uno o dos minutos.
4. Si algo falla, no unir: avisarle a Claude Code. Lo arregla en una tarea que va a `desarrollo` y se vuelve a probar.

**Cuidado con las reglas:** la vista previa, `desarrollo` y la app real usan la misma nube. Si una tarea cambia `firestore.rules`, Claude Code te avisa antes y las escribe para que la app de `main` siga funcionando; publicarlas en la consola de Firebase afecta también a la app de `main`.

## Pruebas automáticas

Son programas que abren la app en un navegador manejado solo (Playwright, con Chromium), en tamaño de celular, y la usan como una persona: tocan botones, escriben y revisan lo que aparece en pantalla. Corren dos veces, en modo claro y en modo oscuro, y fallan si la página tiene algún error. Las pruebas de la nube usan los emuladores de Firebase (una nube falsa que corre en la computadora de Claude Code, con las mismas reglas de `firestore.rules`): nunca tocan la nube real.

- **Qué recorren hoy:** en el modo personal, entrar, cargar un pedido y verlo en Historial; en la nube, registrar una distribuidora, cargar un pedido, armarlo con la checklist, salir a repartir, entregarlo y cobrarlo, y (desde T29b) un pedido viejo en "Cargado en el vehículo" que vuelve atrás y se entrega directo desde "Cargado". Cada tarea suma o ajusta las pruebas de lo que toca.
- **Comando:** `npm test` (necesita Node y Java). Corre todo y deja una captura de cada paso en la carpeta `capturas` (`personal-…` y `nube-…`, cada una en `-claro` y `-oscuro`). Las capturas viejas se borran en cada corrida, así no se acumulan.
- **Archivos:** carpeta `pruebas` (las pruebas, el servidor de prueba y la configuración), `firebase.json` (los emuladores) y `package.json`. Ninguno cambia la app, y Vercel no los publica (`.vercelignore`).
- **Lo que una máquina no prueba:** la impresora Bluetooth, dos celulares reales a la vez y las notificaciones. Eso lo probás vos, solo en las tareas que lo tocan.

## Instrucciones del Proyecto (para pegar en Claude)

> Sos el ingeniero principal de VendeFrío, una PWA móvil para distribuidoras. Leé los archivos del Proyecto antes de responder, empezando por WORKING_GUIDE.md. El dueño del producto es principiante: respondé siempre con pasos numerados (1, 2, 3), explicando los términos técnicos la primera vez, con un solo tema por vez y cerrando con cómo probarlo. No inventes el estado del proyecto y no modifiques código: el código lo cambia solo Claude Code en el repo, con rama y pull request. Protegé los datos y funciones existentes. Separá hechos, opiniones y propuestas, y dame una recomendación principal con sus riesgos. Hablame en español rioplatense.
