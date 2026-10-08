# VendeFrío — Estado del proyecto

**Última actualización:** 2026-10-07
**Repositorio:** `EscabCodex/vendefrio-v2` · rama `main` · fuente de verdad
**Pruebas:** https://vendefrio-v2.vercel.app/ (Vercel)

## Estado actual

PWA de HTML, CSS y JavaScript puro, con datos locales en `localStorage`. Es un prototipo funcional pensado para una sola persona: todavía no hay datos compartidos entre usuarios. Ya se eligió el servicio de datos compartidos (Firebase), pero todavía no está conectado.

**Funciones existentes**
- Inicio con reparto activo, próxima parada sugerida y último pedido.
- Pedido con borrador persistente y envío por WhatsApp.
- Comercios y fichas individuales, con etiquetas de visita.
- Catálogo, marcas y productos.
- Historial y estadísticas.
- Rutas, GPS por comercio, optimización de recorrido y mapas (MapTiler).
- Configuración y respaldo de datos (exportar e importar).
- Barra inferior y menú "Más", íconos SVG propios, modales tipo bottom sheet, toasts, transiciones, háptica y safe areas.
- PWA con service worker.

## Estructura del repo

- **Pantalla y estilos:** `index.html`, `styles.css`, `navegacion3d.js` y `navegacion3d.css`, `menu.js`.
- **Módulos por sección:** `pedidos.js`, `comercios.js`, `comerciosAdmin.js`, `comercioFicha.js`, `productos.js`, `productosAdmin.js`, `catalogo.js`, `historial.js`, `estadisticas.js`, `rutas.js`, `configuracion.js`.
- **Datos:** `database.js`.
- **Mapas:** `maptiler-config.js`.
- **PWA y despliegue:** `manifest.json`, `sw.js`, `icon.svg`, `vercel.json`, carpeta `api`.

## Restricciones (no negociables)

- No migrar de tecnología sin una decisión explícita.
- No modificar código desde varias IAs a la vez.
- No reemplazar archivos parcialmente: siempre archivos completos.
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
- Equipo y reglas de trabajo: ver `WORKING_GUIDE.md`. Gemini quedó afuera del equipo.

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

## Pendientes técnicos

- Revisar el proyecto completo (zip del repo), en especial `database.js`: ver si todos los módulos acceden a los datos a través de él o leen `localStorage` por su cuenta.
- Crear el proyecto en Firebase (plan Spark) con la cuenta de la distribuidora y conectarlo a la app.
- Escribir las reglas de seguridad de Firestore.
- Implementar la migración desde `localStorage` sin pérdida de datos.
- Validar la propuesta de incorporación de empleados.
- Revisar que el repo público no exponga claves de API (por ejemplo, MapTiler).
- Rework visual completo.
- Confirmar que no quedan archivos sueltos o desconectados del resto de la app.

## Bitácora de sesiones

Una línea por sesión: fecha, quién trabajó, qué cambió, qué quedó pendiente.

- 2026-09-09 — Etapa estratégica: se pausó el desarrollo y se definieron visión, flujo del pedido, equipo y roadmap.
- 2026-10-07 — Consolidación de la documentación en 6 archivos. Próximo paso: elegir el servicio de datos compartidos.
- 2026-10-07 — Claude: se eligió Firebase (Firestore + Auth, plan Spark gratuito) y se definió la arquitectura de datos compartidos. Se creó la cuenta de Google de la distribuidora. Sin cambios de código. Próximo paso: revisar el proyecto completo y crear el proyecto en Firebase.
