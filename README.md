# Sistema de Citas MGG

Aplicacion web de gestion de citas y turnos construida con React, Vite y Firebase.

El proyecto cubre varios flujos operativos en una misma base:
- autenticacion y perfiles por rol
- agenda web de citas
- kiosko de turnos
- seguimiento publico por QR/token
- pantalla TV / monitor
- panel de agente y panel admin
- metricas operativas
- solicitudes ARCO

## Stack

- Frontend: React 19 + Vite
- Backend: Firebase Cloud Functions v2
- Base de datos: Firestore
- Hosting: Firebase Hosting
- Seguridad: Firebase Auth, Firestore Rules y App Check

## Modulos principales

- `src/pages/Appointments.jsx`: agenda web de citas con consentimiento de privacidad
- `src/pages/Kiosk.jsx`: generacion de turnos de kiosko
- `src/pages/TicketTracking.jsx`: seguimiento publico por `trackingPublic`
- `src/pages/MonitorScreen.jsx`: pantalla TV / monitor
- `src/pages/AgentPanel.jsx`: operacion de agente
- `src/pages/AdminPanel.jsx`: administracion
- `src/pages/Metrics.jsx`: metricas y reportes
- `src/pages/ArcoRequests.jsx`: formulario ARCO
- `functions/index.js`: Cloud Functions, scheduler, auditoria, exportes y reglas de negocio del backend

## Rutas principales

El router vive en `src/App.jsx` y el frontend se publica bajo `basename="/sistema-citas"`.

- Publicas:
  - `/ingreso`
  - `/registro`
  - `/recuperar-contrasena`
  - `/qr-seguimiento`
  - `/privacidad`
  - `/derechos-arco`
- Protegidas:
  - `/inicio`
  - `/perfil`
  - `/mis-citas`
  - `/agenda`
  - `/kiosko`
  - `/pantalla`
  - `/panel-agente`
  - `/admin`
  - `/admin/arco`
  - `/metricas`

## Roles y guards

Los guards estan en `src/components/common/`.

- `ProtectedRoute`: exige autenticacion
- `AdminRoute`: restringe a admin
- `AgentRoute`: restringe a agente
- `StaffRoute`: habilita staff
- `KioskRoute`: restringe vista kiosko
- `ScreenRoute`: restringe vista pantalla

## Variables de entorno

El frontend usa variables Vite. Copia `.env.example` y completa solo los valores necesarios para tu entorno local.

Variables frontend:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APPCHECK_SITE_KEY`
- `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`

Cloud Functions no usa `.env` para secretos sensibles. Usa Firebase Functions Secrets:
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `APP_PUBLIC_URL`

Ejemplos:
```powershell
copy .env.example .env.local
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase functions:secrets:set MAIL_FROM
firebase functions:secrets:set APP_PUBLIC_URL
```

## App Check

- El frontend inicializa App Check en `src/firebase.js`.
- La mayoria de los callables sensibles usan `enforceAppCheck: true` en `functions/index.js`.
- `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` sirve para desarrollo local. No debe usarse como configuracion productiva.
- Las pruebas smoke con emuladores ya generan token App Check de emulador en `tests/emulator/createArcoRequest.smoke.test.js`.

## trackingPublic

`trackingPublic` expone seguimiento publico saneado por token.

Caracteristicas actuales:
- lectura publica puntual por token
- listado publico bloqueado por reglas
- se usa para QR y seguimiento de cita/turno
- cada documento tiene `expiresAt`
- el frontend descarta documentos expirados
- Cloud Functions limpia documentos expirados de forma programada

Referencias:
- reglas: `firestore.rules`
- backend: `functions/index.js`
- frontend: `src/pages/TicketTracking.jsx`
- utilidades: `src/utils/tracking.js`

## Retencion y export de auditoria

La politica tecnica actual esta centralizada en `functions/auditPolicy.js`.

### auditLogs

- coleccion tecnica de eventos backend
- escritura solo desde Cloud Functions
- lectura denegada desde cliente por reglas
- retencion tecnica: 180 dias
- metadatos: `retentionPolicy`, `retentionDays`, `purgeAfter`, `exportable`
- limpieza programada diaria mediante `cleanupAuditLogs`

### serviceAudit

- bitacora de cierres de atencion para citas y turnos
- lectura permitida a staff/admin por reglas
- retencion documentada: 365 dias
- metadatos de auditoria y export
- no tiene auto-expurgo activo por ahora

### Export de auditoria

El backend expone `adminExportAuditRecords`:
- callable admin-only
- requiere App Check
- aplica rate limit
- soporta `auditLogs` y `serviceAudit`
- exporta JSON
- limita rango a 31 dias por solicitud
- limita cantidad de registros por solicitud

## Seguridad

Puntos relevantes ya presentes en el repo:
- Firestore Rules con permisos por rol en `firestore.rules`
- `trackingPublic` sin `list`
- `slotLocks`, `kioskTurnoLocks`, `auditLogs` y escrituras sensibles bloqueadas al cliente
- App Check en frontend y callables sensibles
- consentimiento de privacidad en agenda web y ARCO

## Desarrollo local

Instalacion:
```powershell
npm install
npm --prefix functions install
```

Frontend:
```powershell
npm run dev
```

Emuladores Firebase:
```powershell
npm run emulators:start
```

Solo Functions:
```powershell
npm --prefix functions run serve:emulator
```

## Build

Build del frontend:
```powershell
npm run build
```

Preview local:
```powershell
npm run preview
```

## Pruebas y lint

Frontend:
```powershell
npm run test:frontend
npm run lint:frontend
```

Functions:
```powershell
npm run test:functions
npm run lint:functions
```

Emuladores:
```powershell
npm run test:emulators
```

Nota: en algunos entornos sandbox el runner `node --test` puede fallar por restricciones de procesos hijo. En ese caso, ejecutar los archivos de prueba individualmente sigue siendo una validacion util.

## Deploy

Deploy de hosting:
```powershell
npm run deploy:hosting
```

Deploy de functions:
```powershell
npm run deploy:functions
```

Deploy de reglas e indices:
```powershell
npm run deploy:firestore
```

## Estructura resumida

```text
src/
  components/
  context/
  hooks/
  pages/
  utils/
functions/
  index.js
  auditPolicy.js
tests/
  emulator/
firestore.rules
firebase.json
```

## Estado del tooling

- Frontend: ESM
- Functions: CommonJS
- ESLint separado por contexto en `eslint.config.js`
- `functions/index.js` se mantiene sin refactor grande por decision deliberada
