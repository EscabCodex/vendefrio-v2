# VendeFrío — Estado del proyecto

**Última actualización:** 2026-10-08
**Repositorio:** `EscabCodex/vendefrio-v2` · rama `main` · fuente de verdad
**Pruebas:** https://vendefrio-v2.vercel.app/ (Vercel)

## Estado actual

PWA de HTML, CSS y JavaScript puro, con datos locales en `localStorage`. Es un prototipo funcional pensado para una sola persona: todavía no hay datos compartidos entre usuarios. Ya se eligió el servicio de datos compartidos (Firebase): el inicio de sesión ya está conectado y al primer ingreso se crea la distribuidora en la nube. Los datos reales todavía no pasan por la nube: solo hay un modo prueba, con una distribuidora de prueba aparte, para probar la sincronización entre celulares. En modo nube, las acciones peligrosas ("Borrar todos los datos", restaurar e importar) ya no pueden vaciar los datos de todos. El repo ya fue revisado completo (ver "Diagnóstico del repo") y el plan de conexión está dividido en tareas (ver "Plan de conexión con Firebase").

**Funciones existentes**
- Inicio con reparto activo, próxima parada sugerida y último pedido.
- Pedido con borrador persistente y envío por WhatsApp.
- Comercios y fichas individuales, con etiquetas de visita.
- Catálogo, marcas y productos.
- Historial y estadísticas.
- Rutas, GPS por comercio, optimización de recorrido y mapas (MapTiler).
- Configuración y respaldo de datos (exportar e importar).
- Cuenta: ingresar y salir con email y contraseña (Firebase Auth). Al primer ingreso se crea la distribuidora en Firestore. No cambia de dónde salen los datos.
- Barra inferior y menú "Más", íconos SVG propios, modales tipo bottom sheet, toasts, transiciones, háptica y safe areas.
- PWA con service worker.

## Estructura del repo

- **Pantalla y estilos:** `index.html`, `styles.css`, `iconos.js`, `menu.js`.
- **Módulos por sección:** `pedidos.js`, `comercios.js` y `productos.js` (listas iniciales de ejemplo), `comerciosAdmin.js`, `comercioFicha.js`, `productosAdmin.js`, `catalogo.js`, `historial.js`, `estadisticas.js`, `rutas.js`, `configuracion.js`.
- **Carga diferida:** `menu.js` carga `configuracion.js`, `estadisticas.js` y `catalogo.js`; `comerciosAdmin.js` carga `comercioFicha.js`; `rutas.js` carga `navegacion3d.js` y `navegacion3d.css`.
- **Datos:** `database.js`.
- **Firebase:** carpeta `firebase` (SDK "compat" 12.19.0 guardado en el repo: `firebase-app-compat.js`, `firebase-auth-compat.js` y `firebase-firestore-compat.js`), `firebase-config.js` (configuración web, pública por diseño), `cuenta.js` (ingresar, salir y aviso de cambio de cuenta; la pantalla está en `configuracion.js`), `distribuidora.js` (alta de la distribuidora al primer ingreso), `nube.js` (adaptador nube con Firestore y modo prueba; el interruptor está en Configuración > Cuenta) y `firestore.rules` (reglas de seguridad; se publican a mano en la consola de Firebase).
- **Funciones de Vercel (carpeta `api`):** `maptiler-config.js` (entrega la clave de MapTiler desde la variable de entorno `MAPTILER_KEY`) y `resolver-maps.js` (lee enlaces de Google Maps).
- **PWA y despliegue:** `manifest.json`, `sw.js`, `icon.svg`, `vercel.json`.
- **Solo para uso local:** `package.json` y `package-lock.json` (servidor de prueba `servor`).

## Restricciones (no negociables)

- No migrar de tecnología sin una decisión explícita.
- No modificar código desde varias IAs a la vez. Desde el 2026-10-07 el código lo modifica **solo Claude Code**, directamente en el repo.
- Claude Code trabaja en una rama nueva y abre un pull request. Nada se une a `main` sin probarlo en la vista previa de Vercel y sin el OK del dueño.
- Una tarea del plan por sesión de Claude Code. No se mezclan tareas.
- No perder los datos existentes de `localStorage` al migrar.
- No usar confirmaciones nativas del navegador.
- No cambiar funciones existentes solo por estética.
- Probar antes de cerrar: celular, claro y oscuro, consola, navegación y regresiones.
- Presupuesto cero adicional: solo servicios gratuitos, sin cargar tarjeta en ningún servicio.

## Decisiones tomadas

- Público inicial: distribuidoras pequeñas, medianas y mayoristas de barrio con reparto propio.
- Una cuenta representa a toda la distribuidora; todos los usuarios autorizados ven los mismos datos.
- El pedido se guarda sin internet y se sincroniza al volver la conexión.
- Estados del pedido: ingresado → en preparación → preparado → cargado en el vehículo → en reparto → entregado (más incidencia y cancelado). No existe "recibido".
- La preparación es una checklist por producto.
- Faltantes: se ajusta la cantidad preparada, se deja observación y se avisa al responsable económico; se conserva lo pedido originalmente.
- Entrega: botón "Marcar como entregado" y foto opcional del comprobante de transferencia.
- Comprobante futuro: boleta simple imprimible. La factura fiscal queda fuera del primer alcance.
- Se mantiene la base HTML, CSS y JS puro y la PWA. `localStorage` sigue siendo la fuente de datos hasta completar y verificar la migración a Firebase.
- Se conserva la dirección visual iniciada: SVG propios, bottom sheets, toasts, transiciones, safe areas y háptica.
- **Modo oscuro (regla de diseño, 2026-10-08):** se respeta al máximo porque ahorra batería y cambia más la apariencia. En modo oscuro, todos los avisos (toasts) y modales llevan fondo oscuro y letras blancas. La única excepción son las confirmaciones, que usan verde y rojo. Vale para el tema "Oscuro" y para "Sistema" cuando el celular está en oscuro.
- Equipo y reglas de trabajo: ver `WORKING_GUIDE.md`. Gemini quedó afuera del equipo.
- Forma de trabajo (2026-10-07): el dueño trabaja desde el celular y Claude Code modifica el repo directamente. Ya no se suben archivos a mano.

### Datos compartidos (decidido el 2026-10-07)

- **Servicio:** Firebase, con Firestore (base de datos) y Firebase Auth (inicio de sesión con email y contraseña).
- **Plan:** Spark, gratuito y sin tarjeta. Si se superan los límites diarios no hay cobro: la sincronización se frena hasta el día siguiente.
- **Motivo principal:** Firestore trae incorporado el trabajo sin conexión (guarda en el celular y sincroniza solo al volver internet), que es central en el flujo del pedido.
- **Cuenta dueña:** una cuenta de Google creada para la distribuidora, con verificación en 2 pasos.
- **Organización de los datos:** cada distribuidora tiene su propio espacio con usuarios, comercios, productos, marcas y pedidos.
- **Pedidos:** guardan cantidad pedida y preparada por producto. El historial de estados solo se agrega: nunca se borra ni se sobrescribe, para que dos usuarios no pisen sus cambios.
- **Sincronización visible:** cada pedido muestra si está pendiente de sincronizar.
- **Seguridad:** reglas de seguridad de Firestore para que solo los usuarios de la distribuidora lean y escriban sus datos. La configuración de Firebase en el código es pública por diseño; la protección está en las reglas.
- **Fotos de comprobante:** se comprimen en el celular y se guardan en Firestore. No se usa Firebase Storage porque exige plan con tarjeta.
- **Migración:** 1) exportar respaldo con la función existente; 2) botón "Subir mis datos a la nube" que copia todo desde `localStorage`; 3) `localStorage` no se borra hasta confirmar que los datos están completos en la nube.
- **Empleado nuevo (propuesta, a validar):** el dueño agrega el email del empleado desde la app; al registrarse con ese email, queda dentro de la distribuidora.

### Estructura en Firestore (validada en T8)

```text
usuarios/{uid}             a qué distribuidora pertenece cada usuario
distribuidoras/{idDistribuidora}   el id es el uid del dueño ("prueba-" + uid para la de prueba)
  miembros/{uid}           usuarios autorizados
  comercios/{id}
  productos/{id}           cada producto en su propio documento, con marca y foto
  config/marcas            orden de marcas
  pedidos/{id}
    estados/{id}           historial de estados: solo se agrega
  rutas/{id}
```

Cómo guarda los datos el adaptador nube (T9): cada registro es un documento con su `id` como nombre. Campos internos: `_orden` (posición en la lista, para que agregar o borrar escriba solo ese registro) y, en productos, `_marca`. `config/marcas` guarda `orden` (orden de marcas) y `marcas` (lista de marcas, para no perder las vacías). Si un registro tiene listas dentro de listas (Firestore no las admite), se guarda entero como texto en `_json`.

Distribuidora de prueba (T9): `distribuidoras/prueba-{uid}`, con `prueba: true`. Cada dueño puede crear solo la suya; no tiene ficha en `usuarios/{uid}` y nunca se mezcla con la real.

Se sumó `usuarios/{uid}` para que cada usuario sepa cuál es su distribuidora sin buscarla (lo van a necesitar los empleados). La distribuidora usa el uid del dueño como id, así cada dueño crea una sola. Las reglas de `firestore.rules` siguen esta estructura y bloquean todo lo demás.

Quedan solo en cada celular: preferencias de apariencia, borrador del pedido y fechas de respaldo.

## Diagnóstico del repo (2026-10-07)

Revisión completa de `main` hecha por Claude antes de conectar Firebase. Sin cambios de código.

### Acceso a los datos

- Comercios, productos, marcas, historial y rutas se leen y guardan **solo** a través de `database.js`.
- Accesos directos a `localStorage` fuera de `database.js`, todos de uso local de cada celular: `configuracion.js` e `index.html` (preferencias de apariencia y fecha de la copia automática), `pedidos.js` (borrador del pedido) y `catalogo.js` (ver error abajo).
- **Error probable:** `catalogo.js` guarda `vendefrio_producto_catalogo_pendiente` al tocar "＋ Agregar al pedido", pero ningún archivo lee esa clave. El botón abriría Pedido sin agregar el producto. (Confirmado y resuelto en T2.)
- **Código viejo:** `database.js` borra cada semana claves `vendefrio_semanal_` que ya nadie crea. Es inofensivo.

### Lo que hay que cambiar antes de Firebase

- **Guardado en bloque:** cada cambio reescribe la lista entera (comercios, productos o historial). Con varios usuarios, el último que guarda pisa al otro. Hay que guardar registro por registro.
- **Sin identificadores únicos:** los pedidos se identifican por su posición en la lista (`eliminarHistorial(indice)`), los comercios por el nombre y los productos por marca y posición. Firestore necesita un ID por documento.
- **Funciones sincrónicas:** `obtenerComercios()` y similares devuelven los datos al instante. Firestore responde en diferido, así que `database.js` necesita una copia en memoria que Firestore mantenga al día.
- **Fotos dentro del catálogo:** las fotos de productos (JPEG de 300 px) están dentro del objeto de productos. Firestore permite 1 MB por documento: cada producto va en su propio documento.
- **Contadores del comercio:** `registrarPedido` suma pedidos al comercio reescribiendo toda la lista.
- **Acciones peligrosas:** "Borrar todos los datos" y "Restaurar respaldo" reescriben todo. En la nube afectarían a todos los usuarios.
- **Datos iniciales:** `comercios.js` y `productos.js` cargan listas de ejemplo cuando no hay datos. En modo nube no deben cargarse solas.

### Claves

- No hay claves escritas en el código. La clave de MapTiler sale de la variable de entorno `MAPTILER_KEY` de Vercel.
- La clave igual llega al navegador para dibujar el mapa. Es normal: la protección es limitarla al dominio en el panel de MapTiler.
- El zip revisado no incluye el historial de GitHub. Si alguna vez se subió una clave escrita, sigue en versiones viejas: conviene regenerarla.
- `api/resolver-maps.js` acepta cualquier dirección web desde cualquier sitio. Puede usarse como intermediario y gastar la cuota gratuita de Vercel. Debe aceptar solo enlaces de Google Maps. (Resuelto en T1.)

### Archivos sueltos

- `maptiler-config.js` en la raíz: nadie lo usa; es una copia vieja de `api/maptiler-config.js`. (Borrado en T1.)
- `VENDEFRIO_MASTER_BRIEF.md`: documentación vieja que nombra archivos que ya no existen e incluye a Gemini. Puede confundir a una IA. (Borrado en T0.)
- Todos los demás archivos están conectados y el service worker los guarda.
- Leaflet se carga desde internet y el service worker no lo guarda. El SDK de Firebase no debe repetir ese problema: va dentro del repo.

## Plan de conexión con Firebase

Cada tarea es una sesión de Claude Code, en su propia rama y con su pull request. Las tareas **M** las hace el dueño a mano; Claude le da los pasos cuando llega el momento. Estado de cada tarea: `[ ]` pendiente, `[x]` hecha.

### Bloque A — Limpieza

- [x] **T0 — Preparar el repo para Claude Code.**
  - Crear `CLAUDE.md` en la raíz, corto, que diga: leer `README.md`, `WORKING_GUIDE.md` y `PROJECT_STATE.md` antes de cualquier cambio; hacer solo la tarea pedida; trabajar en una rama nueva y abrir un pull request sin unirlo a `main`; al terminar, marcar la tarea en el plan, agregar una línea a la bitácora y explicarle al dueño cómo probar en el celular con pasos numerados y nivel principiante, en español rioplatense.
  - Actualizar `WORKING_GUIDE.md` al flujo con Claude Code: reemplazar "archivos completos" y "subir cambios a mano" por rama, pull request y vista previa de Vercel.
  - Agregar `CLAUDE.md` al mapa de documentos de `README.md`.
  - Borrar `VENDEFRIO_MASTER_BRIEF.md`.
  - **Aceptación:** la app no cambia; los documentos quedan coherentes entre sí.
- [x] **T1 — Limpieza de código.**
  - Borrar `maptiler-config.js` de la raíz (no la de `api`).
  - `api/resolver-maps.js` acepta solo enlaces de Google Maps (incluidos los enlaces cortos de Google) y rechaza los demás.
  - **Aceptación:** pegar un enlace de Google Maps en un comercio sigue funcionando; el mapa 3D sigue cargando.
- [ ] **M1 — MapTiler (dueño).** Regenerar la clave, limitarla al dominio de Vercel y actualizar `MAPTILER_KEY` en Vercel.
- [x] **T2 — Botón "＋ Agregar al pedido" del catálogo.**
  - Confirmar el error y arreglarlo: el producto elegido queda cargado en el pedido.
  - **Aceptación:** desde Catálogo se agrega un producto y aparece en Pedido; el borrador del pedido sigue funcionando.

### Bloque B — Preparar los datos (todavía sin Firebase)

- [x] **T3 — Identificadores únicos.**
  - Migración local que asigna un `id` a cada comercio, producto, pedido del historial y ruta guardada que no lo tenga. Puede correr muchas veces sin duplicar ni cambiar ids existentes.
  - Antes de migrar, guardar la copia interna automática.
  - Los nuevos registros nacen con `id`.
  - Exportar e importar respaldo conservan los ids; "combinar respaldo" evita duplicados por id.
  - **Aceptación:** la app se ve y funciona igual; un respaldo exportado muestra ids en todos los registros.
- [x] **T4 — Funciones por id en `database.js`.**
  - Obtener, agregar, actualizar y eliminar por id para comercios, productos, pedidos y rutas.
  - Las rutas guardan el id de cada comercio (y siguen mostrando el nombre).
  - Las funciones viejas siguen existiendo para no romper nada.
  - **Aceptación:** sin cambios visibles; ninguna regresión.
- [x] **T5 — Los módulos guardan registro por registro.**
  - Ningún módulo fuera de `database.js` guarda listas enteras: `comerciosAdmin.js`, `pedidos.js` (incluido `registrarPedido`), `catalogo.js`, `productosAdmin.js`, `historial.js` y `rutas.js` usan las funciones por id.
  - **Aceptación:** probar alta, edición y borrado de comercios, productos, pedidos y rutas.
- [x] **T6 — Capa de datos con adaptador.**
  - `database.js` separa el "adaptador local" (`localStorage`) y deja lista la interfaz para un "adaptador nube".
  - Copia de datos en memoria y un aviso interno cuando los datos cambian, para que las pantallas se vuelvan a dibujar solas.
  - **Aceptación:** sin cambios visibles; todo sigue en `localStorage`.

### Bloque C — Conectar Firebase (con datos de prueba)

- [x] **M2 — Crear el proyecto en Firebase (dueño).** Con la cuenta de la distribuidora: plan Spark, sin Google Analytics, app web, Auth con email y contraseña, Firestore en modo producción con ubicación en Sudamérica. Pasarle a Claude Code el bloque de configuración web (es público por diseño).
- [x] **T7 — SDK de Firebase e inicio de sesión.**
  - Copiar el SDK de Firebase (versión "compat", que funciona sin módulos) dentro del repo y sumarlo al service worker.
  - Archivo de configuración de Firebase.
  - Sección "Cuenta" en Configuración para ingresar y salir.
  - Iniciar sesión **no** cambia de dónde salen los datos: siguen en `localStorage`.
  - **Aceptación:** se puede ingresar y salir; la app abre sin internet; los datos no cambian.
- [x] **T8 — Reglas de seguridad y alta de la distribuidora.**
  - Archivo `firestore.rules` en el repo con la estructura propuesta: solo los miembros leen y escriben su distribuidora; el historial de estados solo admite agregar.
  - Al primer ingreso del dueño se crea su distribuidora y su ficha de miembro.
- [x] **M3 — Publicar las reglas (dueño).** Pegar `firestore.rules` en la consola de Firebase.
- [x] **T9 — Adaptador nube.**
  - Firestore con trabajo sin conexión activado.
  - Lectura con escucha en tiempo real hacia la copia en memoria; escritura documento por documento.
  - En modo nube no se cargan las listas de ejemplo.
  - Interruptor de modo solo para pruebas, con una distribuidora de prueba.
  - **Aceptación:** con datos de prueba, un cambio en un celular aparece en otro; sin internet se guarda y se sincroniza al volver.
- [x] **M3b — Volver a publicar las reglas (dueño).** T9 cambió `firestore.rules` para permitir la distribuidora de prueba: pegar la versión nueva en la consola de Firebase antes de probar el modo prueba.
- [x] **T10 — Proteger acciones peligrosas en modo nube.**
  - "Borrar todos los datos" no actúa sobre la nube.
  - "Restaurar" e "Importar" en modo nube solo combinan sin borrar.
  - **Aceptación:** ninguna acción desde un celular puede vaciar los datos de todos.

### Bloque D — Pasar a la nube

- [ ] **T11 — Migración "Subir mis datos a la nube".**
  - Pide primero exportar un respaldo.
  - Sube en tandas, compara totales (comercios, productos, pedidos, rutas) y muestra un resumen.
  - Recién con todo verificado ofrece pasar a modo nube. `localStorage` no se borra.
  - **Aceptación:** los totales coinciden; volver a correrla no duplica nada.
- [ ] **T12 — Sincronización visible y prueba con dos celulares.**
  - Cada pedido muestra si está pendiente de sincronizar; indicador general de conexión.
  - **Aceptación:** prueba real con dos celulares: carga sin internet, sincronización al volver y dos personas sobre los mismos datos sin pisarse.

### Después del plan

- Incorporación de empleados por email (validar la propuesta).
- Ciclo de estados del pedido, checklist, faltantes y entrega (Etapa 3 del `ROADMAP.md`).

## Decisiones abiertas de la migración

- Cómo se migran los pedidos viejos del historial: sin estado, como "entregado" o como "histórico". Decidir antes de T11.
- Si la copia automática interna y el respaldo por archivo siguen existiendo en modo nube, y cómo.

## Pendientes técnicos

- Ejecutar el plan de conexión con Firebase (T1 a T12).
- Validar la propuesta de incorporación de empleados.
- Rework visual completo.
- Leaflet se carga desde internet y no funciona sin conexión (fuera del plan de Firebase).

## Bitácora de sesiones

Una línea por sesión: fecha, quién trabajó, qué cambió, qué quedó pendiente.

- 2026-09-09 — Etapa estratégica: se pausó el desarrollo y se definieron visión, flujo del pedido, equipo y roadmap.
- 2026-10-07 — Consolidación de la documentación en 6 archivos. Próximo paso: elegir el servicio de datos compartidos.
- 2026-10-07 — Claude: se eligió Firebase (Firestore + Auth, plan Spark gratuito) y se definió la arquitectura de datos compartidos. Se creó la cuenta de Google de la distribuidora. Sin cambios de código. Próximo paso: revisar el proyecto completo y crear el proyecto en Firebase.
- 2026-10-07 — Claude: revisión completa del repo. Los datos compartidos pasan por `database.js`; no hay claves en el código; sueltos: `maptiler-config.js` (raíz) y `VENDEFRIO_MASTER_BRIEF.md`. Falta id único por registro y guardado individual. Se armó el plan de Firebase en tareas T0 a T12. Desde ahora el código lo modifica Claude Code en el repo. Sin cambios de código. Próximo paso: T0.
- 2026-10-08 — Claude Code: T0. `CLAUDE.md` completado con las reglas del plan, `WORKING_GUIDE.md` pasado al flujo de rama, pull request y vista previa de Vercel, `CLAUDE.md` sumado al mapa de `README.md` y borrado `VENDEFRIO_MASTER_BRIEF.md`. Sin cambios de código. Próximo paso: T1.
- 2026-10-08 — Claude Code: T1. Borrado `maptiler-config.js` de la raíz. `api/resolver-maps.js` acepta solo enlaces de Google Maps (incluidos `maps.app.goo.gl`, `goo.gl/maps` y `g.co/kgs`) y sigue las redirecciones solo dentro de dominios de Google. Próximo paso: M1 (dueño) y después T2.
- 2026-10-08 — Claude Code: T2. Confirmado el error: nadie leía `vendefrio_producto_catalogo_pendiente`. `pedidos.js` ahora lee esa clave al abrir Pedido, suma 1 unidad al producto, abre su marca, lo muestra con un aviso y borra la clave; el borrador se guarda como siempre. Además, en modo oscuro el texto de los avisos (toasts) quedaba blanco sobre fondo blanco: ahora tienen fondo oscuro y letras blancas, y se sumó la regla de modo oscuro a "Decisiones tomadas". Próximo paso: T3.
- 2026-10-08 — Claude Code: T3. `database.js` asigna al abrir la app un `id` a cada comercio (`com_`), producto (`prod_`), pedido del historial (`ped_`) y ruta guardada (`ruta_`) que no lo tenga: antes guarda la copia interna automática, no cambia ids existentes, verifica las cantidades y, si algo falla, deja los datos como estaban. Los registros nuevos nacen con id; `obtenerProductos()` y `editarProducto()` conservan el id; restaurar completa ids de respaldos viejos y "combinar respaldo" evita duplicados por id. Se arregló de paso que "combinar respaldo" nunca sumaba productos a una marca existente. Pendiente para T4/T5: al renombrar una ruta, la ruta recibe un id nuevo. Próximo paso: T4.
- 2026-10-08 — Claude Code: T4. `database.js` suma funciones por id para comercios, productos, pedidos y rutas: `obtener…PorId`, `agregar…ConId` (devuelve el id nuevo), `actualizar…PorId` (el id nunca cambia) y `eliminar…PorId`. Cada ruta guarda ahora `idsComercios` junto a los nombres (al abrir la app se completa en las rutas existentes) y sigue mostrando el nombre; `obtenerComerciosDeRuta` busca por id y, si no, por nombre; renombrar un comercio con `actualizarComercioPorId` actualiza el nombre en las rutas. Las funciones viejas siguen igual (solo `agregarRutaGuardada` y `guardarRutasGuardadas` guardan además los ids). Sin cambios visibles. Pendiente para T5: que los módulos usen estas funciones (así, al renombrar una ruta conserva su id). Próximo paso: T5.
- 2026-10-08 — Claude Code: T5. Ningún módulo fuera de `database.js` guarda listas enteras: `comerciosAdmin.js` y `comercioFicha.js` (alta, edición, borrado y marcar visitado o pendiente), `pedidos.js` (`registrarPedido` y el pedido nuevo en el historial), `catalogo.js` (precio y foto), `productosAdmin.js` (alta, edición y borrado de productos), `historial.js` (borrar pedido) y `rutas.js` (guardar, renombrar y borrar rutas, y GPS de comercios) usan las funciones por id. Al renombrar una ruta conserva su id; si el nombre nuevo ya es de otra ruta, se reemplaza esa como antes. Las marcas siguen con sus funciones de siempre (T4 no tiene funciones por id para marcas). Sin cambios visibles. Visto de paso, sin tocar: los botones de acciones de la tarjeta de comercio están ocultos por CSS y esas acciones se usan desde la ficha. Próximo paso: T6.
- 2026-10-08 — Claude Code: T6. `database.js` separa el adaptador local (`adaptadorLocal`, el único que toca `localStorage` para comercios, productos, orden de marcas, historial y rutas) y deja escrita la interfaz que va a cumplir el adaptador nube (`leer`, `guardar`, `borrar`, `escucharCambios`) junto con `usarAdaptadorDatos()` para cambiarlo, que todavía no se usa. Todas las lecturas y escrituras pasan por una copia en memoria (`leerColeccion` y `guardarColeccion`), y hay un aviso interno (`escucharCambiosDatos`) que agrupa los cambios del mismo momento e indica si vinieron de afuera; un cambio hecho en otra pestaña refresca la copia en memoria. Ninguna pantalla se anota todavía al aviso: siguen redibujándose como siempre (se conectan cuando haya cambios desde la nube, T9). Las migraciones de ids de T3 y T4 siguen trabajando sobre `localStorage` tal cual y después recargan la copia en memoria. Preferencias, borrador, fechas y copias de respaldo siguen siendo de cada celular. Sin cambios visibles; todo sigue en `localStorage`. Próximo paso: M2 (dueño) y después T7.
- 2026-10-08 — Claude Code: T7. SDK de Firebase 12.19.0 (versión "compat", solo App y Auth) guardado en la carpeta `firebase` y sumado al service worker (caché `vendefrio-v126`). Nuevo `firebase-config.js` con la configuración web del proyecto `vendefrio` y `cuenta.js` con ingresar, salir y aviso de cambio de cuenta. Configuración tiene una sección "Cuenta" para ingresar con email y contraseña (con botón para ver la contraseña y errores en castellano) y para salir. Iniciar sesión no cambia los datos: siguen en `localStorage`. La app no tiene registro: el usuario se crea en la consola de Firebase. Próximo paso: T8.
- 2026-10-08 — Claude Code: T8. Nuevo `firestore.rules`: solo los miembros leen y escriben su distribuidora (comercios, productos, config, pedidos y rutas); el historial de estados de cada pedido solo admite agregar; nadie borra la distribuidora ni cambia su dueño; todo lo que no está en la estructura queda bloqueado. Se sumó `usuarios/{uid}` a la estructura y la distribuidora usa el uid del dueño como id. Nuevo `distribuidora.js` y SDK de Firestore 12.19.0 ("compat") en la carpeta `firebase`, sumados al service worker (caché `vendefrio-v127`): al primer ingreso crea juntas la distribuidora ("Mi distribuidora"), la ficha de miembro del dueño y la ficha de usuario; si falla, se reintenta al volver a ingresar, al abrir la app o al volver internet. Cuenta muestra el estado de la distribuidora con botón "Reintentar". Reglas y alta probadas con los emuladores de Firebase (33 pruebas de reglas y prueba en navegador). Firestore todavía sin trabajo sin conexión (T9: activarlo antes de cualquier otro uso de Firestore). Hasta publicar las reglas, Cuenta avisa que faltan. Por ahora cualquier usuario que ingresa sin distribuidora crea la suya (los usuarios se crean solo desde la consola). Los datos siguen en `localStorage`. Próximo paso: M3 (dueño) y después T9.
- 2026-10-08 — Claude Code: T9. El dueño confirmó M3 (reglas publicadas). Nuevo `nube.js` con el adaptador nube: lee con escucha en tiempo real hacia la copia en memoria y escribe documento por documento (compara con lo último conocido y sube solo lo que cambió, en tandas). `firebase-config.js` activa el trabajo sin conexión de Firestore (`enablePersistence`, varias pestañas) antes de cualquier otro uso. En modo nube las colecciones arrancan vacías: no se cargan las listas de ejemplo. Interruptor "Modo prueba" en Configuración > Cuenta: crea (con internet) la distribuidora de prueba `prueba-{uid}`, recarga la app y la muestra con un cartel fijo; al apagarlo, al salir de la cuenta o si entra otra cuenta, vuelve a los datos de este celular. En modo prueba los datos reales de `localStorage` no se leen ni se escriben: el borrador del pedido va en otra clave y exportar, importar, combinar, restaurar la copia interna y "Borrar todos los datos" quedan frenados con un aviso; la copia interna automática no se pisa. Cuando un cambio llega de otro celular, las pantallas se redibujan solas. Los scripts de Firebase se cargan antes de `database.js`. `firestore.rules` permite crear la distribuidora de prueba (hay que volver a publicarlas: M3b). Service worker con `nube.js` (caché `vendefrio-v128`). Probado con los emuladores de Firebase: 22 pruebas de reglas y 33 pruebas en navegador con dos celulares simulados (cambios en tiempo real, carga sin señal que se sube al volver, `localStorage` real idéntico antes y después, distribuidora real sin datos). Pendiente: T10 (proteger acciones peligrosas en el modo nube real). Próximo paso: M3b (dueño), probar con dos celulares y después T10.
- 2026-10-08 — Claude Code: T10. El dueño confirmó M3b (reglas nuevas publicadas). En modo nube: "Borrar todos los datos" no borra nada (ni la nube ni este celular) y avisa que se borra de a uno; `borrarTodosLosDatos()` y `restaurarRespaldo()` se niegan solas; "Importar" pasa a "Combinar respaldo" (agrega sin borrar, con aviso de que en la nube no se reemplaza), "Importar y combinar" queda habilitado y "Restaurar última copia interna" combina esa copia con la nube previa confirmación. Después de combinar en la nube no se recarga la app: las pantallas se redibujan solas. Red de seguridad en `nube.js`: un solo guardado no puede borrar más de un registro de la nube a la vez (salvo borrar una marca, que se lleva solo sus productos); si pasa, se frena antes de escribir nada y avisa "Cambio frenado para cuidar los datos". Exportar sigue frenado en modo nube. En modo local todo sigue igual. Visto de paso, sin tocar: "Borrar todos los datos" (y "Importar y combinar respaldo") están en la tarjeta de respaldo vieja del inicio, que `configuracion.js` oculta; hoy no se ven en ninguna pantalla. Service worker con caché `vendefrio-v129`. Probado con los emuladores de Firebase: 26 pruebas en navegador (borrar todo, restaurar, importar y combinar sin perder nada, borrados masivos frenados, borrados de a uno y de marca funcionando, otro celular con los mismos totales y `localStorage` real idéntico). Próximo paso: T11.
