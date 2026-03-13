Proyecto

Sistema de citas en React + Firebase con múltiples vistas y flujos:

autenticación

roles

agenda

kiosko

monitor / pantalla TV

fullscreen

métricas

paneles admin y agente

Reglas obligatorias

Si el usuario pide análisis, diagnóstico o revisión, no modificar archivos.

No refactorizar por iniciativa propia.

No renombrar archivos, componentes, props ni rutas sin instrucción explícita.

No cambiar estilos globales ni layouts compartidos sin advertir impacto.

No tocar Firebase, reglas, índices o lógica de autenticación sin revisión explícita.

Mantener compatibilidad con las vistas que ya funcionan.

Forma de trabajar

Antes de cambiar algo:

Explica qué entendiste.

Lista los archivos involucrados.

Explica qué se podría romper.

Propón el cambio mínimo viable.

Solo después edita.

Criterio técnico

Preferir cambios pequeños y aislados.

Mantener diffs chicos y fáciles de revertir.

No hacer cambios masivos en varios módulos a la vez.

Respetar la estructura JSX existente.

Considerar impacto en:

roles

navegación

agenda

kiosko

monitor / pantalla TV

fullscreen

métricas

Cuando se pida análisis del codebase

Entregar:

mapa de arquitectura

rutas principales

guards y roles

componentes compartidos críticos

archivos frágiles

riesgos de regresión

plan por bloques
Sin modificar archivos.