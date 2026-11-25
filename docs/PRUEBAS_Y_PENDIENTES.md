# Informe de pruebas, limitaciones y pendientes

Fecha de ejecución: 25 de noviembre de 2026 (hora de Bogotá).
Entorno: aplicación desplegada en https://operacionessodiacero.github.io/gestion-activos/ con el backend Apps Script publicado (versión 1) sobre la hoja de cálculo y la carpeta de Drive de producción.
Usuario de prueba: cuenta administradora `operacionessodiacero@gmail.com`.

Todos los registros de prueba tienen `es_prueba = TRUE`, nombre que empieza por **PRB** y código `PRB-…`. Están ocultos por defecto en el inventario, el dashboard, la verificación en campo, las fichas y la criticidad. Para verlos se marca «Incluir registros de prueba». Se pueden eliminar lógicamente desde la ficha de cada activo.

## 1. Despliegue e infraestructura

| Prueba | Resultado | Evidencia |
|---|---|---|
| Copia de seguridad antes de modificar la hoja | OK | `RESPALDOS/… — Antes de instalar` en Drive |
| Creación de las 22 hojas sin tocar «Hoja 1» | OK | Registro de ejecución de `instalar()` |
| Semillas (catálogos, 21 familias, 67 campos técnicos, 12 criterios) | OK | Hojas CATALOGOS, TIPOS_ACTIVOS, CAMPOS_TECNICOS, CRITERIOS_CRITICIDAD |
| Backend publicado y accesible desde otro origen | OK | `GET` → `{"ok":true,"app":"Gestión de Activos"}` |
| Backend rechaza solicitudes sin sesión válida | OK | `AUTH: sesión inválida o vencida` |
| Frontend publicado con GitHub Actions (pruebas, build y Pages) | OK | Workflow «Pruebas y despliegue (GitHub Pages)» en verde |
| Inicio de sesión con Google y rol ADMINISTRADOR | OK | Encabezado de la app |

## 2. Importación del inventario original

| Prueba | Resultado | Evidencia |
|---|---|---|
| Resumen previo (detectados, duplicados, inconsistencias, descartados) | OK | 1MACP 74, 3MOB 51, 4LAB 14, MANT 357; 2EQP 20 descartados |
| Respaldo automático antes de importar | OK | `RESPALDOS/… — Antes de importar …xlsx` |
| Archivo original guardado en Drive | OK | `IMPORTACIONES_ORIGINALES/` |
| Activos importados como «Pendiente de verificación» | OK | 139 filas en ACTIVOS (ACT-000001 a ACT-000139) |
| Actividades de mantenimiento históricas | OK | 357 en MANTENIMIENTO_BASE; 353 enlazadas a su máquina y 4 sin máquina («Volante de inercia 4 (5ta,6ta, terminador)», sin equivalente en 1MACP) |
| Trazabilidad hoja/fila original | OK | 139 «CREADO» y 20 «DESCARTADO» en IMPORTACIONES |
| Importación repetible sin duplicar | OK por diseño (clave `import_key`) y por prueba unitaria. No se volvió a ejecutar en producción para no generar ruido | `tests/domain.test.ts`, `importBatch_` |

## 3. Pruebas de aceptación con registros PRB

Árbol de prueba creado:

```text
PRB-T230-SIS-001  PRB Sistema de accionamiento            (ACT-000140, Sistema)
 ├── PRB-T230-MOT-001  PRB Motor eléctrico principal      (ACT-000141, Equipo)
 │    └── PRB-T230-MOT-001-01  PRB Rodamiento lado acople (ACT-000143, Componente)
 │         └── PRB-T230-MOT-001-01-01  PRB Jaula del rodamiento (ACT-000144, Pieza)
 ├── PRB-T230-RED-001  PRB Reductor de velocidad          (ACT-000142, Equipo)
 └── PRB-T230-ACO-001  PRB Acoplamiento motor-reductor    (ACT-000145, Conjunto)
      ├─ «Está conectado a» → Motor      (REL-000001)
      └─ «Transmite movimiento a» → Reductor (REL-000002)
```

| # | Escenario | Resultado | Evidencia |
|---|---|---|---|
| 1 | Importar un activo desde el Excel original | OK | 139 activos importados (sección 2) |
| 2 | Confirmar su existencia | OK | VER-000001 sobre ACT-000141: estado «Existencia confirmada», ubicación «Nave 1, eje C-4» |
| 3 | Marcar un activo como no localizado | OK | VER-000002 sobre ACT-000142: «No localizado», el activo **no** se eliminó |
| 4 | Crear un activo nuevo | OK | ACT-000140 a ACT-000147, origen «Levantamiento» |
| 5 | Crear un sistema | OK | ACT-000140 |
| 6 | Agregar varios equipos a un sistema | OK | ACT-000141 y ACT-000142 con padre ACT-000140 |
| 7 | Agregar componentes a un equipo | OK | ACT-000143 bajo ACT-000141 |
| 8 | Agregar piezas a un componente | OK | ACT-000144 bajo ACT-000143 |
| 9 | Crear un acoplamiento relacionado con dos equipos | OK | ACT-000145 con REL-000001 y REL-000002 (identidad única, sin duplicar) |
| 10a | Evitar códigos duplicados | OK | «Código duplicado: PRB-T230-MOT-001 ya pertenece a ACT-000141» |
| 10b | Evitar relaciones circulares | OK | Mover el sistema bajo su propia pieza: «Relación circular: ACT-000144 es descendiente de ACT-000140» |
| 10c | Evitar que un activo sea su propio padre | OK | Mensaje de relación circular |
| 10d | Evitar relaciones funcionales duplicadas | OK | «La relación ya existe (REL-000001)» |
| 10e | Reenvío de la cola offline sin duplicar | OK | El mismo `client_uuid` dos veces devuelve el mismo ACT-000146 |
| 11 | Guardar datos técnicos personalizados | OK | DT-000001 a DT-000004 (incluye «No aplica» justificado). Campo nuevo CAM-000068 «PRB Holgura axial medida» creado sin tocar código, con valor DT-000005 |
| 12 | Tomar o cargar una fotografía | OK | FOT-000001 (imagen de placa generada para la prueba) |
| 13 | La fotografía se almacena en Google Drive | OK | Archivo visible en Drive |
| 14 | Nombre, carpeta y asociación | OK | `PRB-T230-MOT-001_PLACA_DE_IDENTIFICACION_20261125_104120_001.jpg` en `Inventario Equipos LAM JAB/GESTION_DE_ACTIVOS/ACTIVOS/ACT-000141_PRB_MOTOR_ELECTRICO_PRINCIPAL/02_PLACAS_DE_IDENTIFICACION`. Fila en FOTOGRAFIAS con drive_id, url, activo y categoría. La foto se fijó como foto principal |
| 15 | Evaluar la criticidad | OK | CRI-000001: IC 3,53 × IP 2 = 7,05 (sería «Media»), pero la regla especial «Seguridad = 5» lo eleva a **Muy alta** |
| 15b | Desconocidos no se asumen bajos | OK | Con 2 de 12 criterios conocidos el resultado es «Pendiente de evaluación», provisional |
| 16 | Registrar un hallazgo | OK | INS-000001 con HAL-000001 «acople sin guarda», severidad Crítica, marcado como riesgo de seguridad (riesgo_seguridad = TRUE) |
| 17 | Guardar información incompleta como borrador | OK | ACT-000147 con `borrador = TRUE` |
| 18 | Cerrar y volver a abrir sin perder información | OK | Recarga completa de la app: el activo, su foto, ficha y criticidad se leen de nuevo desde Google Sheets y Drive |
| 19 | Consultar desde otro dispositivo autorizado | Parcial | Se consultó en una sesión nueva con vista de celular (375×812) y los datos venían del servidor. **Pendiente:** que el usuario abra la app en su celular con la misma cuenta |
| 20 | Datos guardados en Google Sheets | OK | Revisión directa de las hojas ACTIVOS, FOTOGRAFIAS, etc. |
| 21 | Exportar el inventario a Excel | OK | `INVENTARIO_ACTIVOS_2026-11-25.xlsx` (21 KB) y `GESTION_ACTIVOS_COMPLETO_2026-11-25.xlsx` (108 KB) generados como XLSX válidos (se capturaron en el navegador sin descargarlos) |
| 22 | Generar una hoja de vida en PDF | OK | `PRB-T230-MOT-001_HOJA-DE-VIDA_20261125_104256.pdf` guardado en `08_HISTORIAL` del activo. También se puede imprimir o guardar en PDF desde el navegador |
| 23 | Verificar los permisos de usuario | Parcial | Verificado: rechazo de sesiones inválidas y de correos fuera de la lista USUARIOS, más la matriz de roles en el servidor. **Pendiente:** probar con una segunda cuenta Google con rol INSPECTOR o CONSULTA |
| 24 | Visualización en dispositivos móviles | OK | Vista de celular emulada: barra inferior de acceso rápido, ficha del activo, botones de campo y foto principal |
| 25 | Funcionamiento de la aplicación desplegada | OK | Todo lo anterior se ejecutó contra la app publicada |
| — | Repuesto maestro compartido por dos equipos | OK | REP-000001 enlazado a ACT-000141 (en almacén) y ACT-000142 (instalado): AR-000001 y AR-000002 |

Corrección hecha durante las pruebas: Google Sheets convertía la vigencia del formato («08/07/2025») en una fecha ISO dentro de la hoja de vida. Ahora se muestra como dd/mm/aaaa (commit «Hoja de vida: muestra la vigencia…»).

## 4. Limitaciones técnicas conocidas

- **Google Sheets no es una base de datos transaccional.**
  - Cada escritura se serializa con `LockService`, a unos 0,5–1 s por fila.
  - La carga inicial (bootstrap) tarda unos 10 s con unos 500 registros.
  - El límite práctico recomendado es unos 5.000 activos y unos 50.000 filas en total. A partir de ahí conviene migrar a PostgreSQL o similar; la capa de datos (`readAll_`, `insert_`, `update_`) está aislada para esa migración.
- **Cuotas de Apps Script.**
  - Cada ejecución dura como máximo 6 min, por eso la importación va en lotes de 40 activos y 100 actividades.
  - Hay 20.000 llamadas UrlFetch al día, que se usan en la validación de sesión, con caché.
- **Fotos.** Se reducen a 1.920 px en el navegador antes de enviarlas. Los videos no se admiten.
- **Sin conexión.** La app instalada (PWA) guarda en cola los registros y fotos y los envía al volver la señal. La primera carga sí necesita conexión.
- **OCR de placas.** No se implementó. La foto de placa queda asociada para transcribirla manualmente con validación humana.
- **Aplicación OAuth en modo «Prueba».** Solo las cuentas agregadas como usuarios de prueba en Google Cloud pueden iniciar sesión, además de estar en la hoja USUARIOS. Para uso amplio hay que publicar la app OAuth, lo que requiere verificación de Google si se piden datos sensibles; el inicio de sesión básico no los pide.

## 5. Pendientes y siguientes pasos

1. Agregar a los usuarios reales en dos sitios:
   - Configuración → Usuarios y roles en la app.
   - Usuarios de prueba de la pantalla de consentimiento OAuth en Google Cloud.
2. Probar con una cuenta INSPECTOR y otra CONSULTA (escenario 23) y abrir la app desde un celular (escenario 19).
3. Revisar el informe de importación (docs/INFORME_IMPORTACION.md). Resolver con el equipo:
   - El posible duplicado ESCRITORIO VENTAS (MOB-22/MOB-40).
   - Los 11 registros genéricos.
   - Las 22 frecuencias dudosas.
4. Iniciar el levantamiento por área: verificar existencia, foto de placa y código nuevo.
5. Cuando ya no se necesiten, eliminar lógicamente los registros PRB. Quedan en la papelera, con historial.
6. Fases futuras: preventivo, órdenes de trabajo, AMEF/RCM, historial de fallas y KPIs (MTBF/MTTR). El modelo ya tiene identificadores inmutables, jerarquía y MANTENIMIENTO_BASE como punto de partida.
