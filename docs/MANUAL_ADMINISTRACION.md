# Manual de administración

## Recursos
- **Hoja de cálculo (base de datos):** hojas ACTIVOS, VERIFICACIONES, … (ver MODELO_DATOS). La hoja original «Hoja 1» no se modifica.
- **Drive:** `<carpeta raíz>/GESTION_DE_ACTIVOS/{ACTIVOS, REPORTES, IMPORTACIONES_ORIGINALES, RESPALDOS}`.
- **Backend:** proyecto Apps Script «Gestión de Activos – API» (cuenta dueña). Propiedades del script: `SPREADSHEET_ID`, `ROOT_FOLDER_ID`, `CLIENT_ID`, `ADMIN_EMAIL`, `TIMEZONE` (opcional).
- **OAuth:** Google Cloud → Google Auth Platform → Clientes → «Cliente web 1». Orígenes autorizados: `https://operacionessodiacero.github.io`, `http://localhost:5173`.

## Usuarios
Configuración → Usuarios y roles → correo + rol → Autorizar. Desactivar: desmarcar «Activo» (no se borra el historial).
Mientras la app OAuth esté en modo «Prueba» en Google Cloud, cada usuario también debe agregarse en Google Auth Platform → Público → Usuarios de prueba (límite 100). Para quitar ese paso, publique la app («Publicar app»); al pedir solo correo/perfil no requiere verificación de Google.

## Actualizar el backend
1. Edite `backend/Code.gs` en GitHub (PR → main).
2. En el editor de Apps Script reemplace el contenido de Code.gs, guarde y **Implementar → Gestionar implementaciones → Editar → Nueva versión** (la URL no cambia).

## Actualizar el frontend
Cualquier merge a `main` publica automáticamente (GitHub Actions → Pages). Si cambia la URL del backend, edite `frontend/.env.production`.

## Respaldo y recuperación
- **Automático:** antes de instalar y antes de cada importación se copia la hoja completa a `RESPALDOS/`.
- **Manual:** Configuración → Papelera y auditoría → «Crear respaldo ahora». Recomendado: semanal. Opcional: activador de tiempo en Apps Script sobre una función que llame `backup_('Semanal')`.
- **Recuperar un registro eliminado:** Configuración → Ver activos eliminados → Restaurar (eliminación lógica).
- **Recuperar un valor modificado:** la hoja AUDITORIA guarda valor anterior y nuevo de cada campo.
- **Desastre:** abra la copia en RESPALDOS, verifique, y cambie la propiedad `SPREADSHEET_ID` del script a la copia (o copie las hojas de vuelta). Los archivos de Drive no se borran desde la app.

## Importación repetible
Configuración → Importación: cargue el Excel, revise resumen/duplicados/inconsistencias, confirme. Repetirla no duplica: solo completa campos vacíos de los activos ya importados (nunca sobrescribe lo levantado en campo).
