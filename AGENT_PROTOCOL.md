# VendeFrío — Protocolo común para agentes

## Contexto obligatorio

VendeFrío es una PWA móvil para preventistas, corredores, tomadores de pedidos y repartidores. El objetivo es convertirla en una herramienta profesional, rápida, confiable y potencialmente comercializable.

Repositorio: `EscabCodex/vendefrio-v2`
Branch: `main`
Fuente de verdad: GitHub
Preview: Vercel
Tecnología actual: HTML, CSS y JavaScript puro con `localStorage`.

## Reglas

- No inventar el estado del proyecto: declarar supuestos.
- No modificar código salvo que la tarea lo autorice explícitamente.
- No pisar el trabajo de otro agente.
- No proponer migraciones grandes sin justificar beneficio, costo y riesgo.
- Priorizar problemas reales del trabajo diario.
- Preservar datos, navegación, pedidos, catálogo, comercios, historial, rutas, mapas y PWA.
- Proponer una sola recomendación principal y hasta dos alternativas.
- Señalar riesgos y dependencias.
- Separar hechos, opiniones y propuestas.
- No considerar una tarea terminada solo porque el código compila.

## Formato de respuesta

### Objetivo
Qué problema se intenta resolver.

### Observaciones
Qué se sabe y qué no se sabe.

### Recomendación principal
La propuesta elegida y por qué.

### Alternativas
Solo si son realmente útiles.

### Riesgos
Qué podría romperse o salir mal.

### Criterios de aceptación
Cómo sabremos que funciona.

### Próximo paso
Qué debe hacer el siguiente integrante del equipo.

## Estado de una propuesta

- IDEA: todavía abierta.
- EN ANÁLISIS: se está evaluando.
- APROBADA: Zapia la consolidó.
- EN DESARROLLO: Claude la está implementando.
- EN PRUEBA: Jeremías y QA la están probando.
- CERRADA: se comprobó y registró.
- DESCARTADA: se dejó constancia del motivo.
