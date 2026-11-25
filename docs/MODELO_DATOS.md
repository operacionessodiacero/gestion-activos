# Modelo y diccionario de datos

Cada tabla es una hoja de Google Sheets con encabezados en la fila 1. Salvo AUDITORIA, todas incluyen las columnas de control `creado_en, creado_por, actualizado_en, actualizado_por, version, eliminado`.

Relaciones principales: `ACTIVOS.padre_id → ACTIVOS.id` (árbol, sin ciclos); `RELACIONES.origen_id/destino_id → ACTIVOS.id`; `*.activo_id → ACTIVOS.id`; `DATOS_TECNICOS.campo_id → CAMPOS_TECNICOS.id`; `ACTIVOS.tipo_id → TIPOS_ACTIVOS.id`; `ACTIVOS_REPUESTOS.repuesto_id → REPUESTOS.id`; `HALLAZGOS.inspeccion_id → INSPECCIONES.id`.

## ACTIVOS
Inventario maestro. Una fila por activo físico (de empresa a pieza).

`id` · `codigo` · `codigo_anterior` · `nombre` · `tipo_id` · `nivel` · `clasificacion` · `descripcion` · `padre_id` · `area` · `proceso` · `ubicacion_fisica` · `funcion` · `fabricante` · `marca` · `modelo` · `serie` · `pais_fabricacion` · `anio_fabricacion` · `fecha_adquisicion` · `fecha_instalacion` · `fecha_puesta_servicio` · `proveedor` · `vida_util` · `tecnologia` · `fuente_alimentacion` · `especificacion_original` · `riesgo_original` · `estado_verificacion` · `estado_operacional` · `condicion` · `criticidad` · `responsable` · `observaciones` · `origen` · `es_prueba` · `es_generico` · `borrador` · `etapas` · `fuente_info` · `foto_principal_id` · `carpeta_drive_id` · `import_key` · `client_uuid`

## JERARQUIA
Historial de cambios de padre (la relación vigente está en ACTIVOS.padre_id).

`id` · `activo_id` · `padre_anterior_id` · `padre_nuevo_id` · `motivo` · `client_uuid`

## RELACIONES
Relaciones funcionales entre activos (acciona, alimenta, protege…).

`id` · `origen_id` · `tipo` · `destino_id` · `descripcion` · `client_uuid`

## TIPOS_ACTIVOS
Familias tecnológicas y grupos de campos que muestran.

`id` · `nombre` · `familia` · `nivel_sugerido` · `grupos_campos` · `descripcion`

## CAMPOS_TECNICOS
Definición de atributos técnicos dinámicos (configurable).

`id` · `grupo` · `etiqueta` · `tipo_dato` · `unidad` · `opciones` · `familias` · `orden` · `obligatorio`

## DATOS_TECNICOS
Valor de cada atributo por activo, con fuente de información y N/A justificado.

`id` · `activo_id` · `campo_id` · `valor` · `unidad` · `fuente` · `no_aplica` · `justificacion` · `client_uuid`

## VERIFICACIONES
Historial de verificaciones físicas en campo.

`id` · `activo_id` · `fecha` · `usuario` · `resultado` · `ubicacion_encontrada` · `estado_fisico` · `estado_operacional` · `codigo_existente` · `codigo_asignado` · `observaciones` · `pendiente` · `client_uuid`

## INSPECCIONES
Inspecciones de condición (criterios en JSON).

`id` · `activo_id` · `fecha` · `usuario` · `criterios` · `condicion_general` · `observaciones` · `recomendaciones` · `client_uuid`

## HALLAZGOS
Anomalías y necesidades de intervención; riesgo_seguridad resalta casos graves.

`id` · `activo_id` · `inspeccion_id` · `fecha` · `usuario` · `criterio` · `descripcion` · `severidad` · `riesgo_seguridad` · `recomendacion` · `necesidad_intervencion` · `estado` · `client_uuid`

## CRITICIDAD
Evaluaciones de criticidad (historial; vigente=TRUE la actual).

`id` · `activo_id` · `fecha` · `evaluador` · `version_metodologia` · `puntajes` · `justificacion` · `evidencia` · `indice_consecuencia` · `indice_probabilidad` · `puntaje_total` · `resultado` · `regla_aplicada` · `provisional` · `fecha_revision` · `vigente` · `client_uuid`

## CRITERIOS_CRITICIDAD
Criterios, pesos, escalas y reglas especiales.

`id` · `nombre` · `descripcion` · `grupo` · `peso` · `escala` · `regla_especial` · `orden`

## FOTOGRAFIAS
Referencias a fotos en Drive.

`id` · `activo_id` · `categoria` · `drive_id` · `url` · `nombre_archivo` · `carpeta_id` · `fecha` · `usuario` · `descripcion` · `ref_tipo` · `ref_id` · `client_uuid`

## DOCUMENTOS
Referencias a documentos técnicos en Drive.

`id` · `activo_id` · `tipo_documento` · `drive_id` · `url` · `nombre_archivo` · `carpeta_id` · `fecha` · `usuario` · `descripcion` · `client_uuid`

## REPUESTOS
Catálogo maestro de repuestos.

`id` · `codigo` · `descripcion` · `fabricante` · `referencia_comercial` · `numero_parte` · `especificaciones` · `unidad` · `proveedores` · `disponibilidad` · `tiempo_adquisicion_dias` · `costo_estimado` · `criticidad` · `client_uuid`

## ACTIVOS_REPUESTOS
Asociación repuesto↔activo (instalado / recomendado / consumible).

`id` · `activo_id` · `repuesto_id` · `tipo` · `cantidad` · `observaciones` · `client_uuid`

## MANTENIMIENTO_BASE
Actividades históricas importadas (pendientes de validación).

`id` · `activo_id` · `maquina_original` · `proceso` · `actividad` · `consumible` · `descripcion` · `frecuencia_dias` · `estado_validacion` · `observacion_import` · `import_key`

## UBICACIONES
Catálogo de ubicaciones físicas.

`id` · `nombre` · `tipo` · `padre_id` · `descripcion`

## CATALOGOS
Listas desplegables configurables.

`id` · `lista` · `valor` · `orden` · `activo`

## USUARIOS
Usuarios autorizados y rol.

`email` · `nombre` · `rol` · `activo`

## AUDITORIA
Registro de cada cambio (usuario, fecha, campo, antes, después).

`id` · `fecha` · `usuario` · `tabla` · `registro_id` · `accion` · `campo` · `valor_anterior` · `valor_nuevo`

## CONFIGURACION
Parámetros generales y umbrales.

`clave` · `valor` · `descripcion`

## IMPORTACIONES
Trazabilidad fila a fila hacia el archivo original.

`id` · `lote` · `archivo` · `hoja_origen` · `fila_origen` · `codigo_origen` · `registro_destino` · `tabla_destino` · `accion` · `hash` · `datos_originales` · `observaciones`

## Campos clave de ACTIVOS
| Campo | Descripción |
|---|---|
| `id` | Identificador interno inmutable ACT-NNNNNN (servidor). |
| `codigo` | Código visible (metodología de codificación). Único. |
| `codigo_anterior` | Código histórico (p. ej. JAB-MACP-16). |
| `nivel` | Empresa…Elemento mantenible. |
| `padre_id` | Activo padre en el árbol. |
| `estado_verificacion` | Pendiente, Existencia confirmada, No localizado, Trasladado, Desmontado, Fuera de servicio, Dado de baja, Posible duplicado, Incorporado en levantamiento… |
| `condicion` | Excelente…Crítica / No evaluada / No aplica (independiente de la criticidad). |
| `criticidad` | Resultado vigente (Muy alta/Alta/Media/Baja/Pendiente). |
| `origen` | IMPORTADO o LEVANTAMIENTO. |
| `es_prueba` | TRUE = registro de prueba, excluido de indicadores. |
| `es_generico` | TRUE = registro que agrupa varios equipos (requiere desglose). |
| `borrador` | Guardado incompleto para continuar después. |
| `etapas` | JSON con las 10 etapas de avance. |
| `fuente_info` | Verificada / Operadores / Documental / Histórica / Estimada / Pendiente. |
| `especificacion_original, riesgo_original` | Texto tal como venía en el Excel (no se reinterpreta). |
| `import_key` | HOJA|CÓDIGO de origen: hace la importación repetible. |
| `client_uuid` | Idempotencia de creación desde el dispositivo. |
| `carpeta_drive_id` | Carpeta del activo en Drive (fija). |
