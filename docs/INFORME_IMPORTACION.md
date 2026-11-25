# Informe de importación del inventario original

**Archivo:** `46 HOJA DE VIDA EQUIPOS Y MAQUINARIA(1).xlsx` (formato JAB-PA-GEA-F-46).
**Regla general:** se trata como referencia preliminar, no como inventario validado. Todos los activos entran con estado **Pendiente de verificación**, condición **No evaluada**, criticidad **Pendiente de evaluación** y fuente **Histórica**. Los datos faltantes («NA», «N/A», «NO HAY REGISTRO», «NO INDICA», fórmulas rotas) se registran como **pendientes de identificación**; no se inventa información.

## Resumen por hoja
| Hoja | Contenido | Detectados | Importados | Descartados |
|---|---|---|---|---|
| 1MACP | Máquinas y equipos de planta (JAB-MACP-01…74) | 74 | 74 | 0 |
| 2EQP | Plantilla de equipos (JAB-EQP-01…20) | 20 | 0 | 20 |
| 3MOB | Mobiliario y equipos administrativos (JAB-MOB-01…51) | 51 | 51 | 0 |
| 4LAB | Instrumentos de laboratorio (LAB-01…18-JAB) | 14 | 14 | 0 |
| MANT2025 (2) | Actividades de mantenimiento (70 máquinas, 27 tipos de actividad) | 357 | 357 | 0 |
| DATOS | Catálogos (ubicaciones, tecnologías, fuentes, riesgos, frecuencias, responsables) | — | Usados como catálogos | — |
| **Total activos** | | **159** | **139** | **20** |

Distribución de 1MACP por área: T230 (12), T380 (26), Taller (11), Patio y alistamiento (19), Trefilado/Doblado/Electrosoldado (6).

## Trazabilidad
- Cada activo conserva su código como **código anterior** y un `import_key` = `HOJA|CÓDIGO`.
- Cada fila (importada o descartada) queda en la hoja **IMPORTACIONES** con hoja, fila, código, acción y los datos originales completos en JSON.
- Las columnas «ESPECIFICACIÓN TÉCNICA/CAPACIDAD» y «RIESGO DE DAÑO» se guardan textualmente (`especificacion_original`, `riesgo_original`) sin reinterpretarlas como datos técnicos verificados.
- El archivo original se guarda en `Drive/GESTION_DE_ACTIVOS/IMPORTACIONES_ORIGINALES` y se crea un respaldo de la hoja antes de importar.
- La importación es **repetible**: si se vuelve a ejecutar no duplica; solo completa campos vacíos y nunca sobrescribe lo levantado en campo.

## Registros descartados (no son activos)
- **JAB-EQP-01** «MAQUINA TREFILADORA»: fila de ejemplo de la plantilla (especificación «POTENCIA / VOLTAJE / PRESIÓN / RANGO DE MEDICIÓN / ETC», serie 1111222233).
- **JAB-EQP-02** «A» (marca «B», especificación «F»): datos de prueba.
- **JAB-EQP-03…20**: códigos sin datos.

## Posibles duplicados
- **JAB-MOB-22** y **JAB-MOB-40**: ambos «ESCRITORIO VENTAS» en VENTAS. Verificar en campo; si es el mismo, marcar uno como «Posible duplicado».
- «Bomba y pistón de empuje» aparece en T230 (MACP-11) y T380 (MACP-32): **no** se consideran duplicados (áreas distintas), pero conviene diferenciarlos en el nombre.

## Registros genéricos / agrupados (requieren desglose en campo)
MACP-05 Castillos de laminación · MACP-07 Camino de rodillos T230 · MACP-09 Tableros eléctricos T230 · MACP-14 Camino de rodillos horno · MACP-29 Castillos de laminación (5ta, 6ta, terminador) · MACP-30 Bombas agua desbaste T380 · MACP-31 Tableros eléctricos T380 · MACP-37 Bombas de aceite para lubricación · MACP-52 Tortugas · MACP-53 Básculas · MACP-61 Equipos de oxicorte.
Se marcan `es_generico = TRUE`. En campo se recomienda crear cada unidad como hijo del registro genérico.

## Inconsistencias detectadas
1. **Fórmulas rotas** (#REF!, #NAME?) en las columnas de mantenimiento preventivo/correctivo de 1MACP (filas 18–107). Se ignoran.
2. **Datos de ejemplo**: «PEPITO PEREZ» y «DISCO D 4.0» en la fila de Horno T230.
3. **Fecha de compra como año** (2017, 2023, 2024) en la mayoría de máquinas: se conserva como dato pendiente de validar.
4. **Unidades ambiguas**: «9 HP kW» (MACP-30, 55, 56).
5. **Ortografía en catálogos**: «POYECTOS», «ECRITORIO», «COMPUTDOR», «ELETRONICO», «MÉCANICO», «COSINA», «ABLORATORIO». Se importan tal cual (trazabilidad) y se corrigen en los catálogos nuevos.
6. **Columna MARCA con componentes** en computadores (MOB-26…29): se conserva en marca; revisar en campo.
7. **Nombre de máquina en MANT2025 que no coincide con 1MACP:** «Volante de inercia 4 (5ta,6ta, terminador)» (4 actividades quedan sin activo asociado). «Desbaste», «Camino de rodillos» y «Bombas de aceite para lubricación» se asociaron por coincidencia parcial dentro de la misma área y quedan marcadas para validar.
8. **Frecuencias dudosas** (marcadas ⚠️ en la app, 22 casos): p. ej. cambio de retenes de Bomba de agua 1 cada **1 día**, cambio de rodamientos cada **7 días**, reparación de puentes grúa cada 1 día, cambio de cuchillas cada 1 día.
9. **Actividad vs. descripción**: Bobinadora «Cambio de cauchos poliuretano…» con descripción «Análisis de aceite de los motorreductores».
10. **Huecos en la numeración** de laboratorio: LAB-11, 13, 14 y 15 no existen.
11. **Imágenes**: el archivo solo contiene el logo corporativo; no hay fotografías de equipos.

## Clasificación preliminar por familia
Se propone un tipo según el nombre (p. ej. «Motor eléctrico…» → Motor eléctrico) únicamente para mostrar la ficha técnica adecuada; es editable y no agrega datos técnicos. 14 registros quedan como «Genérico / por clasificar».
