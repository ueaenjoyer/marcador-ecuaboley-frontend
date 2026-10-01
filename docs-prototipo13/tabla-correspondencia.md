# Prototipo 13 — Tabla correspondencia servidor ↔ cliente (Marcador Ecuavoley)

Backend: Express + Zod (`backend/src/validations/`, `backend/src/controllers/`).
Cliente: `mobile/lib/models/`, `mobile/lib/partidos/`.

| # | Servidor | Cliente | Tipo / nulable | Divergencia |
|---|----------|---------|----------------|-------------|
| 1 | `POST /api/auth/register {nombre,email,password} → {usuario,accessToken,refreshToken}` | `api.post('/auth/register')` en `app/register.tsx` | `Usuario{id,email,nombre,role}` no nulable | Ninguna, rol forzado `JUEZ` en servidor |
| 2 | `POST /api/auth/login {email,password} → {usuario,accessToken,refreshToken}` | `api.post('/auth/login')` en `app/login.tsx` | igual | Ninguna |
| 3 | `POST /api/auth/refresh {refreshToken} → {accessToken,refreshToken}` | `doRefresh()` en `lib/api.ts` (single-flight) | solo renueva `accessToken` en store | Cliente conserva `refreshToken` viejo hasta rotación ok |
| 4 | `GET /api/partidos → Partido[]` | `repoListPartidos()` → `ReadResult<Partido[]>` | `creador?` ausente en listado → `undefined` | @divergencia: listado sin `creador` poblado |
| 5 | `POST /api/partidos {equipoA{nombre,colorHex},equipoB{...},puntosObjetivo,setsParaGanar}` | `repoCrearPartido(payload)` | `nombre: string` (acepta `''`) | @divergencia: `''` → UI muestra fallback por color |
| 6 | `GET /api/partidos/:id → Partido{equipos,sets}` | `repoGetPartido(id)` + `partidoFromJson()` | `equipoGanador: {id,nombre} \| null` | @divergencia: `equipoGanadorId FK|null` → objeto\|null |
| 7 | `GET /api/partidos/sala/:codigo → Partido` (pública) | `repoGetPorSala(codigo)` | igual | Ninguna, sin JWT |
| 8 | `POST /:id/punto {equipoGanadorJugadaId} → {tipo,registroPuntoId,partido}` | `repoRegistrarJugada()` | `tipo: 'PUNTO'\|'CAMBIO'` | Servidor decide PUNTO/CAMBIO por batida, cliente no razona |
| 9 | `POST /:id/undo → Partido` | `repoUndo()` | transaccional | Sin cruce entre sets |
| 10 | `POST /:id/siguiente-set → Partido` | `repoSiguienteSet()` | batida al perdedor | Solo si no hay set activo y partido no finalizado |
| 11 | `PATCH /:id {estado} → Partido` | `repoCambiarEstado()` | solo `ACTIVO\|PAUSADO` | `FINALIZADO` lo pone el motor, no el usuario |
| 12 | `DELETE /:id → 204` | `repoEliminarPartido()` | `void` | Cascade en servidor |
| 13 | `{error:{code,message}}` | `ApiError{status,code}` → `toDomainMessage()` | `code?: string` nulable | 401 renueva, 403 permiso, 0/TIMEOUT red |

Cliente HTTP: `fetch` nativo (13 endpoints, auth custom single-flight ya probada, `AbortController` cubre timeout/cancel, cero deps nuevas en Expo SDK 54).
Instancia única: `mobile/lib/api.ts` + config en `mobile/lib/config.ts` (`EXPO_PUBLIC_API_URL`, fallback dev `http://192.168.101.14:3000/api`).
Orden interceptores: `log(dev, Authorization oculto) → inject-token(SecureStore) → fetch+timeout 10s → validate-status → refresh-401(1 reintento, marca alreadyRetried, single-flight) → 403 passthrough`.
