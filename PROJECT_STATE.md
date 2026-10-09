# VendeFrío — Estado del proyecto

**Última actualización:** 2026-10-09
**Repositorio:** `EscabCodex/vendefrio-v2` · rama `main` · fuente de verdad
**Pruebas:** https://vendefrio-v2.vercel.app/ (Vercel)

## Estado actual

PWA de HTML, CSS y JavaScript puro, con datos locales en `localStorage`. Es un prototipo funcional pensado para una sola persona: todavía no hay datos compartidos entre usuarios. Ya se eligió el servicio de datos compartidos (Firebase): el inicio de sesión ya está conectado y al primer ingreso se crea la distribuidora en la nube. Ya existe la migración "Subir mis datos a la nube" (Configuración > Cuenta): copia los datos de este celular a la distribuidora real, verifica los totales y recién ahí ofrece pasar a modo nube; `localStorage` no se borra y se puede volver a los datos del celular. También sigue el modo prueba, con una distribuidora de prueba aparte. En modo nube, las acciones peligrosas ("Borrar todos los datos", restaurar e importar) ya no pueden vaciar los datos de todos. Al abrir la app sin sesión aparece la pantalla de inicio (T13), con registro de la distribuidora. Los empleados entran con un código que genera el dueño en Configuración > Empleados (T14); falta publicar las reglas nuevas (M5) para que funcione en la nube real. El repo ya fue revisado completo (ver "Diagnóstico del repo") y el plan de conexión está dividido en tareas (ver "Plan de conexión con Firebase").

**Funciones existentes**
- Inicio con reparto activo, próxima parada sugerida y último pedido.
- Pedido con borrador persistente y envío por WhatsApp.
- Comercios y fichas individuales, con etiquetas de visita.
- Catálogo, marcas y productos.
- Historial y estadísticas.
- Rutas, GPS por comercio, optimización de recorrido y mapas (MapTiler).
- Configuración y respaldo de datos (exportar e importar).
- Cuenta: ingresar y salir con email y contraseña (Firebase Auth). Al primer ingreso se crea la distribuidora en Firestore. Iniciar sesión no cambia de dónde salen los datos.
- Subir mis datos a la nube (T11): respaldo obligatorio, subida en tandas, totales verificados, paso a modo nube y botón para volver a los datos del celular. Los pedidos subidos llevan la etiqueta "Histórico" en Historial.
- Sincronización visible (T12): en modo nube, cartel fijo abajo con la conexión y los cambios sin subir; en Historial, cada pedido que todavía no llegó a la nube dice "Pendiente de sincronizar". Los demás celulares pasan a la nube con "Usar la nube sin subir datos".
- Pantalla de inicio (T13): al abrir sin sesión, "Distribuidora" (ingresar o "Registrarse", que crea la cuenta y la distribuidora), "Empleado" y "Continuar sin iniciar sesión" (queda recordado). Con sesión se entra directo, también sin internet.
- Ingreso del empleado con código (T14): el dueño genera en Configuración > Empleados un código (8 caracteres, una vez, 24 horas) o un "Código de reingreso" para otro celular. El empleado lo escribe en "Empleado", queda con una cuenta anónima, carga su nombre (obligatorio) y sus roles (opcionales) y usa la nube de la distribuidora. El celular viejo de un reingreso pierde el acceso y vuelve al inicio.
- Barra inferior y menú "Más", íconos SVG propios, modales tipo bottom sheet, toasts, transiciones, háptica y safe areas.
- PWA con service worker.

## Estructura del repo

- **Pantalla y estilos:** `index.html`, `styles.css`, `iconos.js`, `menu.js`.
- **Módulos por sección:** `pedidos.js`, `comercios.js` y `productos.js` (listas iniciales de ejemplo), `comerciosAdmin.js`, `comercioFicha.js`, `productosAdmin.js`, `catalogo.js`, `historial.js`, `estadisticas.js`, `rutas.js`, `configuracion.js`.
- **Carga diferida:** `menu.js` carga `configuracion.js`, `estadisticas.js` y `catalogo.js`; `comerciosAdmin.js` carga `comercioFicha.js`; `rutas.js` carga `navegacion3d.js` y `navegacion3d.css`.
- **Datos:** `database.js`.
- **Firebase:** carpeta `firebase` (SDK "compat" 12.19.0 guardado en el repo: `firebase-app-compat.js`, `firebase-auth-compat.js` y `firebase-firestore-compat.js`), `firebase-config.js` (configuración web, pública por diseño), `cuenta.js` (ingresar, salir y aviso de cambio de cuenta; la pantalla está en `configuracion.js`), `distribuidora.js` (alta de la distribuidora al primer ingreso), `nube.js` (adaptador nube con Firestore, modo prueba, migración "Subir mis datos a la nube" y modo nube real; todo se maneja desde Configuración > Cuenta) y `inicio.js` (pantalla de inicio y registro, T13; pasos del empleado, T14), `empleados.js` (códigos, ingreso del empleado con cuenta anónima, reingreso y lista de empleados, T14) y `firestore.rules` (reglas de seguridad; se publican a mano en la consola de Firebase).
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
- **Pedidos viejos (decidido el 2026-10-08):** al subir los datos a la nube (T11), todos los pedidos del historial se marcan como **"histórico"**. No es un estado del recorrido: no se pasa de "histórico" a otro estado ni al revés, y no se agrega ninguna entrada al historial de estados (no se inventan fechas ni usuarios). Se ven en Historial y Estadísticas, pero nunca en las vistas de trabajo (a preparar, en reparto, etc.). Se descartaron "sin estado" (podían aparecer como pendientes) y "entregado" (era un dato inventado que después no se puede borrar). La migración se hace en un momento sin pedidos pendientes, por ejemplo al final del día después de repartir; si alguno quedara pendiente, se carga de nuevo como pedido nuevo.
- **Empleado nuevo:** reemplazado por "Usuarios y acceso" (decidido el 2026-10-09, ver abajo). Ya no se usa el email del empleado.

### Usuarios y acceso (decidido el 2026-10-09)

Problema: hoy los celulares entran todos con la cuenta del dueño y no se sabe quién hizo cada cosa. Además, un registro abierto con email permitiría que cualquiera entre y gaste el límite gratuito de Firebase. Todo esto entra en el plan gratuito (Spark), sin funciones pagas.

**Pantalla de inicio**
- Al abrir la app sin sesión aparece una pantalla con dos accesos: **"Distribuidora"** (dueño, encargado o persona a cargo) y **"Empleado"**. Abajo, **"Continuar sin iniciar sesión"**.
- "Continuar sin iniciar sesión" es la app como funcionaba antes de Firebase: los datos quedan solo en ese celular y no se comparten. El celular recuerda la elección y no vuelve a preguntar; desde Configuración > Cuenta se puede ingresar después.
- Quien ya ingresó no vuelve a ver la pantalla: la sesión queda guardada en el celular y la app abre y trabaja sin internet (T12). Solo el primer ingreso o el registro necesitan internet.

**Distribuidora (dueño o encargado)**
- Ingresa con email y contraseña. Tiene botón **"Registrarse"**: crea la cuenta y su distribuidora vacía. El nombre de la distribuidora es obligatorio al registrarse y se ve en el inicio, debajo de "VendeFrío", y en Configuración > Cuenta, donde el dueño puede cambiarlo.
- Si al registrarse el celular tiene datos propios, se le ofrece la migración de T11 ("Subir mis datos a la nube"); si no, usa la nube directamente.
- Solo la cuenta dueña de la distribuidora ve el panel de empleados y las acciones delicadas (subir datos, juntar repetidos).

**Empleado: ingreso con código**
- El encargado genera un **código de acceso** en Configuración > Empleados y se lo pasa al empleado (en persona o por WhatsApp).
- El código tiene 8 caracteres sin letras que se confundan (sin 0/O ni 1/I), sirve **una sola vez** y **vence a las 24 horas**. Así nadie puede adivinar uno ni entrar sin permiso del encargado.
- El empleado elige "Empleado", escribe el código y la app le crea una **cuenta anónima** (cuenta sin email ni contraseña, guardada en ese celular). Las reglas de seguridad de Firestore revisan el código y lo suman a la distribuidora.
- Después completa **su nombre (obligatorio)** y **sus roles (opcional)**. Sin nombre no avanza.
- **Roles (actualizado el 2026-10-09):** casillas que se pueden marcar varias a la vez (por ejemplo, un repartidor que además vende y arma pedidos). Se puede no marcar ninguna.
- **El encargado edita la lista de roles** (Configuración > Empleados > "Editar roles"): crear roles nuevos, cambiarles el nombre y eliminarlos. Los roles nuevos aparecen enseguida en la lista para elegir, en todos los celulares. Los empleados no pueden editar la lista.
- Cada distribuidora arranca con 5 roles precargados, que también se pueden editar o eliminar:
  - **Vendedor:** visita comercios y toma pedidos (preventista).
  - **Depósito:** prepara los pedidos con la checklist y carga el vehículo.
  - **Repartidor:** reparte y marca los pedidos como entregados.
  - **Cobranza:** cobra y revisa los comprobantes de transferencia.
  - **Administración:** controla pedidos, faltantes y precios desde la oficina; es el "responsable económico" que recibe el aviso de faltantes (ver "Decisiones tomadas").
- Cada rol tiene un id que no cambia: al renombrarlo, los empleados que lo tienen lo conservan con el nombre nuevo.
- Eliminar un rol que tienen empleados pide confirmación con la cantidad ("lo tienen 3 empleados") y se lo quita a esos empleados; no se borra ningún empleado. No se pueden crear dos roles con el mismo nombre.
- Por ahora los roles son solo nombres. En la Etapa 3, como los roles son editables, los permisos no van a depender del nombre: cada rol va a tener sus propias casillas de permiso (por ejemplo "prepara pedidos", "entrega", "recibe aviso de faltantes"). El encargado puede cambiar los roles de cualquier empleado desde el panel.
- El empleado siempre usa la nube de la distribuidora: no tiene "datos de este celular", ni migración, ni modo prueba, ni acciones delicadas.

**Si el empleado cambia de celular o se le borran los datos**
- La sesión no se cierra sola ni vence: no hace falta un botón "Mantener sesión activa". El acceso se pierde solo si se cambia de celular, se borran los datos del navegador o se desinstala la app.
- Solución: la persona es la **ficha de empleado** (nombre, roles e historial), no el celular. El encargado toca **"Código de reingreso"** en la ficha de ese empleado; el empleado lo escribe en el celular nuevo y vuelve a ser **el mismo empleado**, con su nombre, roles e historial. El celular viejo pierde el acceso automáticamente. Mismas reglas que el código nuevo: una vez, 24 horas.
- Prevención: la pantalla del empleado recomienda **instalar la app en la pantalla de inicio**. En iPhone, Safari puede borrar los datos de una web que no se usa en 7 días si no está instalada; instalada como app, no.
- Lo que se registre en los pedidos (Etapa 3) guarda el id de la ficha de empleado y su nombre, no el de la cuenta anónima, para que el historial no se corte al cambiar de celular.

**Panel de empleados (Configuración > Empleados, solo encargado)**
- Lista de empleados con nombre, roles y si está activo.
- **Alta:** generar código nuevo. **Roles:** marcar o desmarcar. **Reingreso:** generar código para otro celular. **Baja:** quitar el acceso.
- Al dar de baja, la nube le niega el acceso al instante (aunque tenga la app abierta); su celular borra la copia de los datos de la nube y vuelve a la pantalla de inicio. La ficha queda guardada como "dado de baja" para que su nombre siga apareciendo en el historial.
- Los códigos sin usar se pueden anular desde el panel.

**Estructura en Firestore (validada en T14)**

```text
codigosAcceso/{codigo}          idDistribuidora, idEmpleado, tipo ("alta" o "reingreso"),
                                creado (vence 24 horas después), usado, usadoPor, usadoEn
                                y, en el reingreso, uidAnterior (la cuenta que pierde el acceso)
usuarios/{uid}                  para empleados: idDistribuidora e idEmpleado
distribuidoras/{id}
  empleados/{idEmpleado}        nombre, roles (lista de ids de rol), activo, uidActual, alta
  config/roles                  lista: [{ id, nombre }] (solo la escribe el dueño)
  miembros/{uid}                para empleados: rol "empleado", idEmpleado y el código usado
```

- La ficha de empleado nace cuando el empleado usa un código de alta, no cuando el dueño lo genera (decidido con el dueño el 2026-10-09): así un código sin usar no deja fichas vacías. Solo se puede crear con un código del dueño.
- Al usar un código, una sola tanda marca el código como usado, suma la cuenta como miembro, crea la ficha (o, en el reingreso, la pasa a la cuenta nueva y borra la ficha de miembro de la vieja) y crea su ficha de usuario. Las reglas revisan que el código sea de esa distribuidora y esa ficha, que no esté usado ni vencido, y que todo pase junto.
- La lista de roles se crea con los 5 precargados cuando el dueño genera su primer código.
- Una cuenta anónima nunca puede crear una distribuidora.

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
- [x] **M1 — MapTiler (dueño).** Regenerar la clave, limitarla al dominio de Vercel y actualizar `MAPTILER_KEY` en Vercel.
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

- [x] **T11 — Migración "Subir mis datos a la nube".**
  - Pide primero exportar un respaldo.
  - Sube en tandas, compara totales (comercios, productos, pedidos, rutas) y muestra un resumen.
  - Todos los pedidos del historial suben marcados como "histórico" (ver "Datos compartidos"). Avisa que conviene hacerla sin pedidos pendientes.
  - Recién con todo verificado ofrece pasar a modo nube. `localStorage` no se borra.
  - **Aceptación:** los totales coinciden; volver a correrla no duplica nada.
- [x] **T12 — Sincronización visible y prueba con dos celulares.**
  - Cada pedido muestra si está pendiente de sincronizar; indicador general de conexión.
  - **Aceptación:** prueba real con dos celulares: carga sin internet, sincronización al volver y dos personas sobre los mismos datos sin pisarse.

### Bloque E — Usuarios y acceso (cierra la Etapa 2)

Reglas completas en "Usuarios y acceso" (Decisiones tomadas).

- [x] **T13 — Pantalla de inicio y registro de la distribuidora.**
  - Pantalla al abrir sin sesión: "Distribuidora", "Empleado" (todavía sin funcionar: avisa que llega en T14) y "Continuar sin iniciar sesión".
  - "Distribuidora": ingresar con email y contraseña y "Registrarse" (nombre de la distribuidora obligatorio; crea cuenta y distribuidora). Con datos propios en el celular ofrece la migración de T11; sin datos, usa la nube directamente.
  - "Continuar sin iniciar sesión" queda recordado en el celular; desde Configuración > Cuenta se puede ingresar después.
  - Quien ya tiene sesión entra directo, también sin internet.
  - **Aceptación:** registrarse con un email nuevo crea la distribuidora y entra a la nube; el dueño actual entra como siempre con sus datos; "Continuar sin iniciar sesión" muestra los datos de antes; la app abre sin internet con sesión iniciada; `localStorage` intacto.
- [x] **M4 — Inicio anónimo (dueño).** En la consola de Firebase, activar el método de inicio de sesión "Anónimo". Claude Code pasa los pasos.
- [x] **T14 — Ingreso del empleado con código.**
  - En Configuración > Empleados, el encargado genera un código (8 caracteres, una vez, 24 horas).
  - "Empleado" en la pantalla de inicio: código → cuenta anónima → nombre obligatorio y roles opcionales, varios a la vez, de la lista de roles de la distribuidora (si todavía no existe, se crea con los 5 precargados) → entra a la nube de la distribuidora.
  - Ficha de empleado y código de reingreso para otro celular (el celular viejo pierde el acceso).
  - El empleado no ve migración, modo prueba ni acciones delicadas. Recomendación de instalar la app en la pantalla de inicio.
  - `firestore.rules`: solo el dueño crea códigos y fichas; un código sirve una vez y vence; el empleado solo edita su nombre y sus roles.
  - **Aceptación:** con dos celulares, el empleado entra con un código y ve los mismos datos; un código usado, vencido o inventado no deja entrar; el reingreso en otro celular conserva nombre y rol y saca al celular viejo; reglas probadas con los emuladores.
- [ ] **M5 — Publicar las reglas nuevas (dueño).** Pegar `firestore.rules` en la consola de Firebase.
- [ ] **T15 — Panel de empleados.**
  - Lista con nombre, roles y estado; cambiar roles; anular códigos sin usar; dar de baja.
  - "Editar roles": crear, renombrar y eliminar roles (al eliminar uno en uso, confirma con la cantidad y se lo quita a esos empleados). `firestore.rules`: solo el dueño escribe `config/roles`.
  - Baja: la nube le niega el acceso al instante; su celular borra la copia de la nube y vuelve a la pantalla de inicio; la ficha queda como "dado de baja".
  - **Aceptación:** con dos celulares, dar de baja al empleado con la app abierta lo saca enseguida; un rol creado en un celular aparece en el otro, renombrarlo lo cambia en los empleados que lo tienen y eliminarlo se lo quita sin borrar empleados; un empleado dado de baja no puede volver a entrar sin un código nuevo; los datos de la distribuidora no se tocan.

### Después del plan

- Ciclo de estados del pedido, checklist, faltantes y entrega (Etapa 3 del `ROADMAP.md`), con permisos por rol.

## Decisiones abiertas de la migración

- Si la copia automática interna y el respaldo por archivo siguen existiendo en modo nube, y cómo.

## Pendientes técnicos

- Bloque E: usuarios y acceso (M5 y T15).
- Idea para más adelante (pedido del dueño, 2026-10-09): ingresar con Google. Se puede en el plan gratuito, pero antes hay que planificar qué pasa si el dueño entra con Google usando el mismo email de su cuenta con contraseña (Firebase puede tomarlas como la misma cuenta y cambiar cómo se ingresa) y probar la ventana de Google en iPhone con la app instalada. No se activó en la consola.
- El buscador de Configuración no oculta las filas que no coinciden (`.configFila` le gana a `.oculto` en `styles.css`). Visto en T14, sin tocar.
- Rework visual completo. Incluye mover el indicador de conexión de T12 (hoy, cartel chico abajo) arriba a la derecha del nombre "VendeFrío", donde dice "Reparto Activo" (pedido del dueño, 2026-10-09).
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
- 2026-10-08 — Claude: decisión sobre los pedidos viejos. Al migrar (T11) todos se marcan como "histórico": se ven en Historial y Estadísticas, no en las vistas de trabajo, y no se inventan entradas en el historial de estados. La migración se hace sin pedidos pendientes. Sin cambios de código. Próximo paso: T11.
- 2026-10-08 — Claude Code: T11. Configuración > Cuenta tiene la tarjeta "Subir mis datos a la nube" (solo con cuenta, distribuidora lista, sin modo prueba y con los datos del celular): 1) "Exportar respaldo" obligatorio; 2) "Subir mis datos", con confirmación que avisa que conviene hacerlo sin pedidos pendientes y que todos los pedidos quedan como "histórico"; sube comercios, productos (con su marca), marcas y su orden, pedidos y rutas en tandas (hasta 400 escrituras o 4 MB) y espera que la nube confirme cada una; 3) compara los totales leyendo del servidor y muestra "X de Y ✓"; 4) recién con todo verificado aparece "Usar la nube desde ahora". Cada registro sube con su id como nombre del documento y se saltea si ya está en la nube: volver a correrla no duplica ni pisa nada, y si se corta a la mitad "Reintentar" sube solo lo que falta. Los pedidos suben con `estado: "historico"` y sin entradas en el historial de estados. Los documentos quedan iguales a los que escribe el adaptador nube, así el primer cambio en modo nube escribe solo ese registro. Nuevo modo nube real en `nube.js` (clave `vendefrio_modo_nube` con `{ uid, distribuidora }`): mismo adaptador que el modo prueba, apuntando a `distribuidoras/{uid}`. Al pasar a la nube se vacía la copia interna de Firestore del celular (no `localStorage`), porque la que quedaba de la migración dejaba trabada la escucha en tiempo real. En Cuenta, en modo nube: estado de la conexión, "Volver a los datos de este celular" (con confirmación) y sin modo prueba; "Salir de la cuenta" avisa que vuelve a los datos del celular. Historial muestra la etiqueta "Histórico". `localStorage` no se borra ni se cambia. No hizo falta tocar `firestore.rules`. Service worker con caché `vendefrio-v130`. Probado con los emuladores de Firebase: 40 pruebas (120 comercios, 150 productos con fotos, 950 pedidos y 2 rutas; sin internet, corte a la mitad, reintento, segunda corrida sin duplicar, faltantes que se completan, pedidos como histórico, otro celular en tiempo real, volver y salir, `localStorage` idéntico) y 6 pruebas del modo prueba sin cambios. Pendiente para T12: un segundo celular solo puede entrar al modo nube corriendo la migración, que subiría sus propios datos (por ejemplo, las listas de ejemplo); hace falta "Usar la nube sin subir datos" para los demás celulares. Si después de volver a los datos del celular se sube otra vez, reaparece en la nube lo que se había borrado allá. Próximo paso: probar T11 y después T12.
- 2026-10-08 — Claude Code: arreglo de T11 (repetidos). El dueño subió sus datos y aparecieron comercios y productos repetidos en la nube. Causa probable: la subida se corrió también en la vista previa de Vercel, que guarda sus propios datos (las listas de ejemplo, con otros ids). Ahora la migración saltea un comercio o ruta si en la nube ya hay uno con el mismo nombre, y un producto si ya hay uno con la misma marca y nombre, aunque tengan otro id; los totales se verifican igual. Los pedidos no se comparan por nombre. Service worker con caché `vendefrio-v131`. Probado con los emuladores de Firebase: 7 pruebas nuevas (subir desde dos lugares no repite) y las 40 de T11. El dueño dio el OK para juntar los repetidos que ya están en la nube: en modo nube, Configuración > Cuenta tiene "Juntar comercios y productos repetidos" (necesita estar "Conectada"). Agrupa comercios por nombre y productos por marca y nombre (sin importar mayúsculas ni tildes); de cada grupo queda la copia que usan las rutas o, si no, la que tiene más datos, y se le pasan los datos que le falten (`pedidosRealizados` toma el mayor y `ultimaVisita` la más nueva). Las rutas pasan a apuntar a esa copia, sin paradas repetidas; se saca de la lista de marcas la marca que quedó vacía si estaba repetida con otra escrita parecido. Los pedidos no se tocan. Antes de escribir descarga un respaldo de toda la nube (`vendefrio-antes-de-juntar-repetidos-FECHA.json`, se puede combinar). Pide confirmación con las cantidades y se puede repetir: si se corta, sigue desde donde quedó. Escribe directo en Firestore en tandas (no pasa por la red de seguridad de T10, que frena borrar varios registros desde la app). Probado con los emuladores: 21 pruebas (33 comercios y 20 productos de más, datos combinados, ruta corregida, marca repetida, 950 pedidos intactos, 120 fotos, otro celular, sin internet). En el emulador, el otro celular recibe los borrados de a uno (unos 24 segundos para 33); la nube real los manda juntos.
- 2026-10-08 — Claude Code: T12. Indicador general de conexión: en modo nube, un cartel fijo abajo (`indicadorNube`) dice "Conectada · todo subido", "Subiendo N cambios…", "Sin señal · N cambios sin subir", "Conectando…" o el error; en modo prueba se suma al cartel de modo prueba ("Modo prueba · …"). En modo oscuro va con fondo oscuro y letras blancas. Historial muestra "Pendiente de sincronizar" en cada pedido que la nube todavía no confirmó, y Configuración > Cuenta dice cuántos cambios esperan subir. `nube.js` escucha también los avisos de sincronización de Firestore (`includeMetadataChanges`): "Conectada" ahora significa que la nube confirmó los datos (antes bastaba la copia del celular) y sin señal se avisa enseguida. Nuevo "Usar la nube sin subir datos" en Cuenta (pendiente de T11): para los demás celulares, pasa a la nube sin subir sus propios datos; solo se permite si la nube ya tiene datos. `localStorage` no se borra ni se cambia. Service worker con caché `vendefrio-v132`. Probado con los emuladores de Firebase: 32 pruebas con dos celulares simulados (A sube y pasa a la nube, B usa la nube sin subir y ve los mismos totales, cuenta con nube vacía frenada, A sin señal carga un pedido y edita un comercio mientras B edita otro y carga otro pedido, al volver la señal los dos ven todo sin pisarse, etiquetas e indicador que se limpian, modo prueba, modo oscuro, `localStorage` real idéntico). Falta la prueba real con dos celulares del dueño (guion en el pull request). Próximo paso: probar T12 con dos celulares; con eso se completa el plan de Firebase.
- 2026-10-09 — Claude Code: el dueño probó T12 con dos celulares reales y anduvo todo (carga sin señal, sincronización al volver y dos personas sobre los mismos datos sin pisarse). Comentario de diseño, para el rework visual: el indicador de conexión no va como cartel chico abajo, sino arriba a la derecha del nombre, donde hoy dice "Reparto Activo". Anotado en "Pendientes técnicos" y en `ROADMAP.md`. Sin cambios de código. Queda pendiente M1 (MapTiler). Próximo paso: decidir si se cierra la Etapa 2.
- 2026-10-09 — Claude Code: el dueño confirmó M1 (clave de MapTiler regenerada, limitada al dominio y actualizada en Vercel); marcada en el plan. Con eso el plan de Firebase queda completo. Se anotó la idea de registro y de ingreso obligatorio, todavía sin decidir en qué etapa va. Sin cambios de código.
- 2026-10-09 — Claude Code: decisión "Usuarios y acceso" con el dueño. Pantalla de inicio con "Distribuidora" (email, contraseña y "Registrarse"), "Empleado" (código del encargado: 8 caracteres, una vez, 24 horas; nombre obligatorio y rol opcional de una lista fija) y "Continuar sin iniciar sesión". Si el empleado cambia de celular, el encargado le da un código de reingreso y vuelve a ser la misma ficha de empleado (no hace falta "mantener sesión activa": la sesión no vence). Panel de empleados con alta, roles, reingreso y baja. Plan en el Bloque E (T13, M4, T14, M5, T15), que cierra la Etapa 2. Sin cambios de código. Próximo paso: T13.
- 2026-10-09 — Claude Code: el dueño ajustó los roles: casillas que se pueden marcar varias a la vez, sobre una lista fija de 5 (Vendedor, Depósito, Repartidor, Cobranza, Administración); se sacó "Otro". Sin cambios de código.
- 2026-10-09 — Claude Code: el dueño pidió roles editables. La distribuidora arranca con los 5 roles precargados y el encargado puede crear, renombrar y eliminar roles desde "Editar roles" (en T15); cada rol tiene un id fijo y, en la Etapa 3, sus propias casillas de permiso. Sin cambios de código.
- 2026-10-09 — Claude Code: T13. Antes de programar se revisó el registro: hoy cualquiera con la configuración pública de Firebase puede crear una cuenta (aun sin botón en la app) y, con ella, su distribuidora, y gastar el cupo diario gratuito, que es compartido. El dueño decidió dejar el registro abierto, sin protecciones extra: la app es de uso personal, para él y 4 o 5 compañeros de trabajo. Nuevo `inicio.js`: al abrir la app sin sesión aparece una pantalla de inicio (tapa toda la app) con "Distribuidora", "Empleado" y "Continuar sin iniciar sesión". "Distribuidora" ingresa con email y contraseña (como en Configuración > Cuenta: los datos siguen saliendo de donde salían) o "Registrarse" (email, contraseña de al menos 6 caracteres repetida): crea la cuenta (`registrarse` en `cuenta.js`) y `distribuidora.js` crea la distribuidora como siempre. Si el celular solo tiene las listas de ejemplo, pasa directo a la nube con la distribuidora vacía (`usarNubeNueva` en `nube.js`); si tiene datos propios (pedidos, rutas o comercios y productos distintos de los de ejemplo), ofrece "Subir mis datos a la nube" (abre Configuración > Cuenta con la migración de T11) o "Ahora no". "Empleado" avisa que llega en T14. "Continuar sin iniciar sesión" guarda `vendefrio_inicio_sin_sesion` y no vuelve a preguntar. Con sesión guardada no aparece la pantalla, también sin internet. Errores en castellano (email ya usado, contraseña corta o distinta). Modo oscuro con fondo oscuro y letras blancas. No se tocaron `firestore.rules` ni los datos de `localStorage`. Service worker con `inicio.js` (caché `vendefrio-v133`). Probado con los emuladores de Firebase: 31 pruebas en navegador (pantalla sin sesión, empleado, seguir sin sesión recordado, registro sin datos que entra a la nube vacía, registro con datos que ofrece la migración, email repetido y contraseña mala, ingreso del dueño con sus datos, apertura sin internet con sesión, `localStorage` idéntico). Próximo paso: M4 (dueño) y después T14.
- 2026-10-09 — Claude Code: correcciones de T13 pedidas por el dueño. "Empleado" ahora dice "Ingresá con el código que te dará tu encargado". "Registrarse" pide el nombre de la distribuidora (obligatorio, hasta 80 caracteres): `distribuidora.js` lo recibe antes de crear la cuenta (`prepararNombre`) y crea la distribuidora con ese nombre en la misma tanda; si el registro falla, se descarta. Quien ingresa sin registrarse sigue recibiendo "Mi distribuidora". Probado con los emuladores de Firebase: 36 pruebas en navegador (las 31 de T13 y 5 nuevas: texto de empleado, sin nombre o con solo espacios no deja avanzar, nombre guardado en la nube). Próximo paso: M4 (dueño) y después T14.
- 2026-10-09 — Claude Code: el dueño pidió ver el nombre de la distribuidora. Con sesión iniciada, el inicio lo muestra debajo de "VendeFrío"; en Configuración, la fila "Cuenta" dice "nombre · email" y adentro de Cuenta aparece "Distribuidora: nombre" con "Cambiar nombre" (solo el dueño; no deja guardarlo vacío). `distribuidora.js` escucha en tiempo real el documento de la distribuidora (`nombreActual`, `escucharNombre`, `cambiarNombre`): un cambio de nombre llega solo a los otros celulares y sin internet se ve el último nombre conocido. Sin sesión no se muestra nada. No hizo falta tocar `firestore.rules` (ya dejaban al dueño cambiar el nombre). La distribuidora del dueño, creada en T8, se llama "Mi distribuidora" hasta que la renombre. Probado con los emuladores de Firebase: 46 pruebas en navegador (las 36 anteriores y 10 nuevas). Próximo paso: M4 (dueño) y después T14.
- 2026-10-09 — Claude Code: T14. El dueño confirmó M4 (inicio anónimo activado) y aprobó el plan. Nuevo `empleados.js`: el dueño genera en Configuración > Empleados (fila visible solo para el dueño) un código de 8 caracteres sin 0/O ni 1/I, que sirve una vez y vence a las 24 horas, con "Copiar" y "Compartir"; si es el primero, crea `config/roles` con los 5 roles precargados. El empleado toca "Empleado" en la pantalla de inicio (o "¿Sos empleado?" en Configuración > Cuenta sin sesión), escribe el código (acepta minúsculas, espacios y guion) y la app crea la cuenta anónima y, en una sola tanda, marca el código como usado, lo suma como miembro y crea su ficha de empleado; si el código no sirve, avisa por qué (no existe, ya se usó, venció) y cierra la cuenta anónima. Después pide nombre (obligatorio) y roles (opcionales, varios a la vez) con la recomendación de instalar la app, y entra a la nube de la distribuidora. "Código de reingreso" en la lista de empleados del dueño: el celular nuevo es la misma ficha (nombre y roles, sin volver a pedirlos) y el viejo pierde el acceso al instante: vacía su copia de la nube, cierra la sesión y vuelve al inicio con el aviso "Este celular ya no tiene acceso". La Cuenta del empleado muestra nombre, roles, distribuidora, conexión, "Cambiar mi nombre o mis roles" y "Salir" (no deja salir con cambios sin subir); no ve migración, modo prueba, juntar repetidos, cambiar nombre de la distribuidora, volver a los datos del celular ni restaurar o importar respaldos. `distribuidora.js` ya no crea una distribuidora para una cuenta anónima. `firestore.rules`: códigos (solo el dueño los crea; se leen de a uno; el uso se valida en la misma tanda), fichas de empleado (el empleado solo cambia su nombre y sus roles), `config/roles` solo el dueño, reingreso y bloqueo de distribuidoras para cuentas anónimas; lo que usa la versión de `main` sigue igual. Lista de empleados mínima (nombre, roles y código de reingreso); cambiar roles, anular códigos y dar de baja quedan para T15. `localStorage` no se borra (solo se sacan las claves de modo de empleado al perder el acceso o salir). Service worker con `empleados.js` (caché `vendefrio-v134`). Probado con los emuladores de Firebase: 66 pruebas de reglas, 58 pruebas en navegador con cuatro celulares simulados (código mal escrito, inventado, usado y vencido; alta con nombre y roles; datos compartidos en los dos sentidos; reingreso que conserva la ficha y saca al celular viejo; carga sin señal; salir; modo oscuro; `localStorage` del dueño y del empleado idénticos), 1 de apertura sin internet con el service worker y 6 con la versión de `main` contra las reglas nuevas (registro, carga, cambio de nombre, segundo celular y modo prueba). Próximo paso: M5 (dueño: publicar las reglas) y probar con dos celulares; después T15.
