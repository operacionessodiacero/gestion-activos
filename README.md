# Gestión de Activos Industriales

Aplicación web (PWA instalable) para el **levantamiento, verificación física, caracterización técnica, jerarquía, criticidad y documentación** de los activos físicos de la planta. Es la base para evolucionar hacia un CMMS.

| Componente | Tecnología | Dónde vive |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite, PWA (offline con cola de sincronización) | GitHub Pages (`frontend/`) |
| Backend / API | Google Apps Script (Web App, JSON) | Proyecto Apps Script del dueño (`backend/Code.gs`) |
| Base de datos | Google Sheets (una hoja por tabla) | Hoja privada de la empresa |
| Archivos | Google Drive (`GESTION_DE_ACTIVOS/…`) | Carpeta privada de la empresa |
| Autenticación | Google Identity Services (ID token) validado en el servidor + lista `USUARIOS` con roles | — |

> El repositorio contiene **solo código**. No contiene datos de la planta, contraseñas, tokens ni llaves. El ID de cliente OAuth y la URL del backend son valores públicos por diseño: el acceso real lo controla el backend.

## Documentación
- [Arquitectura y decisiones técnicas](docs/ARQUITECTURA.md)
- [Modelo y diccionario de datos](docs/MODELO_DATOS.md)
- [Metodología de codificación](docs/METODOLOGIA_CODIFICACION.md)
- [Metodología de criticidad](docs/METODOLOGIA_CRITICIDAD.md)
- [Manual de usuario](docs/MANUAL_USUARIO.md)
- [Manual de administración, respaldo y recuperación](docs/MANUAL_ADMINISTRACION.md)
- [Informe de importación del inventario original](docs/INFORME_IMPORTACION.md)
- [Pruebas, limitaciones y pendientes](docs/PRUEBAS_Y_PENDIENTES.md)

## Desarrollo local
```bash
cd frontend
npm ci
cp .env.production .env.local   # ajustar VITE_API_URL si se usa otro backend
npm run dev                     # http://localhost:5173/gestion-activos/
npm test
```
Cada `push` a `main` ejecuta pruebas, compila y publica en GitHub Pages (`.github/workflows/deploy.yml`).
