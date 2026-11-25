# Arquitectura

```
 Celular / tablet / PC (PWA)                    Google (cuenta de la empresa)
 ┌──────────────────────────┐   HTTPS POST     ┌─────────────────────────────┐
 │ React + TS (GitHub Pages)│ ───────────────▶ │ Apps Script Web App (API)   │
 │  · Google Sign-In        │  {token,action,  │  · valida ID token (aud)    │
 │  · Cola offline IndexedDB│   payload}       │  · USUARIOS + roles         │
 │  · Caché de lectura      │ ◀─────────────── │  · LockService, versiones   │
 └──────────────────────────┘      JSON        │  · Auditoría                │
                                               └──────┬───────────────┬──────┘
                                                      │               │
                                              Google Sheets      Google Drive
                                              (tablas)           (fotos/documentos/respaldos)
```

## Decisiones
1. **GitHub Pages + Apps Script.** Pages solo sirve archivos estáticos; el procesamiento seguro (escritura en Sheets/Drive) lo hace Apps Script, que se ejecuta como el dueño de los recursos. Así la hoja y la carpeta **no se comparten ni se hacen públicas**.
2. **Autenticación.** El usuario inicia sesión con Google (GIS). El frontend envía el ID token; el backend lo valida con `oauth2.googleapis.com/tokeninfo`, verifica `aud` = CLIENT_ID y que el correo esté activo en `USUARIOS`. Los permisos por rol se verifican en el servidor (el frontend solo oculta botones).
3. **Google Sheets como base transaccional (etapa 1).** Ventajas: costo cero, visible para la empresa, exportable. Limitaciones y mitigaciones:
   - Concurrencia: todas las escrituras usan `LockService` (serializadas) + control optimista por columna `version` (si otro usuario modificó el registro se rechaza con «CONFLICTO»).
   - Duplicados: cada creación lleva `client_uuid`; reintentos (mala señal) no duplican. La importación usa `import_key`.
   - Cuotas: ~20.000 llamadas UrlFetch/día y 6 min por ejecución; tiempo de respuesta 1–3 s por operación. Adecuado para decenas de usuarios y < 50.000 filas por hoja. Por encima, migrar.
   - Integridad referencial: validada en el backend (padre existe, sin ciclos, código único, relaciones no repetidas). Las eliminaciones son lógicas (`eliminado=TRUE`).
4. **Capa de datos aislada.** El frontend solo conoce `src/api.ts` (acciones `bootstrap`, `save`, `verify`, …). El backend concentra el acceso en `readAll_/insert_/update_`. Migrar a PostgreSQL = reimplementar esas funciones (o una API REST con las mismas acciones) sin tocar la interfaz.
5. **Offline.** La app (PWA) se instala y abre sin señal; los registros se guardan en una cola IndexedDB y se envían en orden al volver la conexión, mostrando cuántos faltan. Registros creados sin señal pueden recibir hijos/fotos usando IDs temporales `tmp:` que se resuelven al sincronizar.
6. **Fotos privadas.** Las vistas previas se obtienen vía backend (miniatura de Drive en base64); no se cambian permisos de los archivos.
7. **Identificador inmutable.** `ACT-000001` lo asigna el servidor y nunca cambia; el código visible y la ubicación pueden cambiar sin perder historial, fotos ni relaciones. La carpeta de Drive se crea una vez y se guarda su ID.

## Preparado para CMMS
El modelo deja listos los puntos de anclaje: `MANTENIMIENTO_BASE` (actividades históricas), `HALLAZGOS` (backlog/solicitudes), `CRITICIDAD` (priorización), `REPUESTOS`/`ACTIVOS_REPUESTOS`, jerarquía y relaciones funcionales (para AMEF/RCM). Siguientes tablas previstas: `ORDENES_TRABAJO`, `PLANES_MP`, `FALLAS`, `MEDICIONES` (predictivo), `PERSONAL`, `COSTOS`.
