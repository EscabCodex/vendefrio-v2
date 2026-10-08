# VendeFrío — Guía de trabajo

Cómo trabajamos con IAs en este proyecto. Está escrita para que cualquier IA nueva sepa, apenas la lee, con quién habla y cómo ayudar.

## Para la IA que lee esto: quién es el dueño del producto y cómo hablarle

El dueño del producto (Jeremías) es principiante en programación y en IA. Si le decís "subí este archivo a GitHub y probalo en Vercel" o "editá este archivo", ya sabe qué hacer. Lo que más le cuesta son **los pasos intermedios**: qué hacer primero, dónde hacer clic, cómo saber si salió bien. Aprendió mucho con este proyecto, pero todavía está aprendiendo cómo funciona este mundo.

**Cómo responderle:**

1. **Pasos numerados en cada mensaje que incluya tareas.** Paso 1, paso 2, paso 3. Cada paso es una sola acción concreta.
2. **Nivel de alguien que está aprendiendo, no de un niño.** Explicar cada término técnico la primera vez, en una frase (por ejemplo: "commit = guardar un cambio en GitHub"). Indicar dónde hacer clic y qué debería ver si salió bien.
3. **Una tarea por vez.** Si pasa de unos 6 pasos, partir en etapas y esperar su confirmación antes de seguir.
4. **Cerrar cada tarea con cómo probarla:** abrir Vercel, probar en el celular y qué mandar si falla (captura de pantalla o mensaje de error).
5. **Avisar antes de pedirle que borre o reemplace algo**, y decir qué se pierde si lo hace.
6. **Español rioplatense, tono cercano.** Sin relleno.
7. **Escribe por dictado de voz**, así que pueden aparecer errores de transcripción (por ejemplo "Cloud" por Claude). Interpretar con criterio y preguntar solo si de verdad hay duda.

## Roles

- **Dueño del producto (Jeremías):** define problemas reales y prioridades, sube los archivos a GitHub, prueba en Vercel y en su celular, y mantiene estos documentos al día.
- **Claude:** ingeniería principal. Programa, diseña la interfaz directamente en código, entrega archivos completos y redacta la documentación.
- **Zapia:** ideas de producto y orden de prioridades. Conoce bien el proyecto.
- **DeepSeek:** tareas chicas (ajustar un texto, resolver una duda puntual).
- **Generador de imágenes (a definir):** solo para logo e ilustraciones puntuales. Los íconos funcionales son SVG propios.

## Reglas

1. **Una sola IA modifica el código a la vez.** Las demás proponen, revisan o preparan especificaciones.
2. **GitHub es la fuente de verdad.** Vercel es la zona de prueba.
3. **Archivos completos, nunca fragmentos.** Cada entrega informa qué cambió, qué no y qué quedó pendiente.
4. **No se rompen datos ni funciones existentes** (ver `PROJECT_STATE.md`).
5. **Toda tarea nueva** declara problema, usuario, resultado esperado, archivos involucrados, riesgos y criterio de aceptación.
6. **Si algo no está definido, se pregunta o se declara como supuesto.** No se inventa el estado del proyecto.
7. **Cada propuesta tiene un estado:** IDEA → EN ANÁLISIS → APROBADA → EN DESARROLLO → EN PRUEBA → CERRADA o DESCARTADA (con motivo).

## Varios chats, memoria y límite de uso

Cada chat de Claude parte de cero y no garantiza recordar los anteriores. La app puede guardar algunos datos generales, pero no cambios de código ni decisiones finas, así que no se confía en eso. **La memoria del proyecto vive en GitHub y en estos documentos, no en los chats.**

- **Un chat por tarea.** Los chats largos gastan más límite porque en cada mensaje se vuelve a leer toda la conversación.
- **Cada chat nuevo recibe** los archivos de código que se van a tocar, **bajados del repo en ese momento**, nunca una copia vieja. Si el chat está dentro del Proyecto de Claude, los `.md` ya los tiene.
- **Pedido completo en un solo mensaje**, y archivos completos como respuesta.
- **Fuera de las horas pico** (días de semana, de día) el límite rinde más.
- **Al cerrar una tarea:** subir los archivos a GitHub, anotar el reporte de sesión en la bitácora de `PROJECT_STATE.md` y recién después abrir el siguiente chat.

## Rutina de cada sesión

1. **Abrir un chat nuevo dentro del Proyecto de Claude** (o, sin Proyecto, adjuntar `README.md`, `WORKING_GUIDE.md` y `PROJECT_STATE.md`).
2. **Adjuntar los archivos de código** que se van a modificar, bajados del repo.
3. **Describir la tarea completa** en un solo mensaje.
4. **Subir a GitHub** los archivos que entregue la IA y probar en Vercel y en el celular.
5. **Pedir el reporte de sesión** (qué cambió, qué quedó pendiente, qué se decidió) y agregarlo a la bitácora de `PROJECT_STATE.md`.
6. **Actualizar `PROJECT_STATE.md`** también en el Proyecto de Claude.

## Cómo armar el Proyecto de Claude (guía para el dueño)

Un Proyecto es un espacio de trabajo con instrucciones y archivos propios. Cada chat nuevo que se abre adentro ya los tiene, sin adjuntar nada. Hace falta un plan de pago, y conviene armarlo desde la web de Claude. Los nombres de los botones pueden cambiar: ante la duda, la IA debe verificar cómo está hoy en la ayuda oficial.

1. Entrar a claude.ai desde el navegador con la cuenta que tiene el plan de pago.
2. Ir a **Projects** y elegir **New project**. Ponerle de nombre "VendeFrío".
3. En las instrucciones del Proyecto, pegar el texto de la sección "Instrucciones del Proyecto" de más abajo.
4. En los archivos del Proyecto, subir los 6 `.md`: `README.md`, `WORKING_GUIDE.md`, `PRODUCT.md`, `ORDER_FLOW.md`, `ROADMAP.md` y `PROJECT_STATE.md`.
5. Abrir los chats siempre desde adentro del Proyecto, uno por tarea.
6. Cuando cambie `PROJECT_STATE.md`, borrar la versión vieja en el Proyecto y subir la nueva. Los archivos del Proyecto son una foto: no se actualizan solos cuando cambia GitHub.

Importante: el Proyecto da contexto a todos sus chats, pero los chats **no se comparten entre sí**. Lo que une a los chats son los archivos.

## Recordatorio: subir cambios y probar

1. Abrir el repo en GitHub y entrar a **Add file → Upload files** (o abrir el archivo y editarlo con el lápiz).
2. Subir el archivo completo, con el mismo nombre que el original, para reemplazarlo.
3. Guardar el cambio (**Commit changes**).
4. Esperar uno o dos minutos a que Vercel publique la nueva versión.
5. Abrir https://vendefrio-v2.vercel.app/ en el celular y probar lo que se cambió.
6. Si algo falla, mandar a la IA una captura de pantalla o el mensaje de error.

## Instrucciones del Proyecto (para pegar en Claude)

> Sos el ingeniero principal de VendeFrío, una PWA móvil para distribuidoras. Leé los archivos del Proyecto antes de responder, empezando por WORKING_GUIDE.md. El dueño del producto es principiante: respondé siempre con pasos numerados (1, 2, 3), explicando los términos técnicos la primera vez, con un solo tema por vez y cerrando con cómo probarlo. No inventes el estado del proyecto y no modifiques código salvo que la tarea lo autorice. Entregá archivos completos. Protegé los datos y funciones existentes. Separá hechos, opiniones y propuestas, y dame una recomendación principal con sus riesgos. Hablame en español rioplatense.
