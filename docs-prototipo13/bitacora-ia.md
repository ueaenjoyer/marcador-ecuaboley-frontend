# Bitácora IA — Prototipo 13 (Marcador Ecuavoley)

## Herramienta
- Muse Spark (OpenCode) — modelo muse-spark-1.3-contributor-free.

## Consultas realizadas
1. Revisar contrato API backend vs cliente móvil (`controllers/`, `validations/`, `mobile/lib/api.ts`, `auth-store.ts`, `types.ts`, `socket.ts`).
2. Qué falta del listado de 22 orientaciones (base por ambiente, timeouts, logging, modelos, remote/local/repo, 4 familias de error, reintentos, cancelación, HTTPS prod).
3. Implementar con `fetch` (decisión del estudiante), sin `expo-sqlite`, con placeholder prod HTTPS.

## Resultados utilizados
- Se mantuvo refresh single-flight + `alreadyRetried` anti-bucle de Semana 12.
- Se centralizó URL en `lib/config.ts` con `EXPO_PUBLIC_API_URL/SOCKET_URL`.
- Se añadió `toDomainMessage()` para las 4 familias de fallo.

## Modificaciones aplicadas
- `mobile/lib/config.ts` (nuevo): BASE/SOCKET_URL, IS_DEV, ENABLE_HTTP_LOG solo dev, timeouts 10s, reintentos GET, HTTPS obligatorio en prod.
- `mobile/lib/socket.ts`: usa SOCKET_URL centralizada.
- `mobile/lib/api.ts`: timeouts explícitos, `signal` para cancelación, log dev con Authorization oculto, reintento solo GET idempotente con backoff 500ms*2^n, traducción red→dominio, POST punto/undo jamás reintentan.
- `mobile/lib/models/usuario.ts`, `partido.ts` (nuevos): 2+ entidades, opcionales `|null`, `@divergencia` documentada, `fromJson` sin `any`.
- `mobile/lib/partidos/partidos-remote.ts|partidos-local.ts|partidos-repository.ts` (nuevos): separación remota/local/repositorio, snapshot offline solo lectura, escrituras sin snapshot.
- `mobile/docs-prototipo13/tabla-correspondencia.md` + esta bitácora.

## Verificaciones técnicas
- `npx tsc --noEmit` en `mobile/`: limpio.
- `npm test` en `mobile/`: 18/18 pasan (validation + auth-store).
- `grep fetch\(` en `mobile/app`: 0 llamadas crudas (solo `refetch` de Query, falso positivo).
- `grep JWT_SECRET|API_KEY|SECRET` en `mobile/lib`: 0 secretos incrustados; tokens solo en SecureStore.
- Recorrido manual pendiente en Expo: login → crear → punto → forzar expiración (`JWT_ACCESS_EXPIRY=30s` o borrar `auth_token`) → comprobar `401→refresh→retry` transparente → borrar refresh → `login?expired=1`.

## Decisiones con implicación de seguridad
- No se guarda punto/undo offline (evita duplicar jugadas; servidor árbitro supremo).
- Log nunca imprime `Authorization`; desactivado en prod (`ENABLE_HTTP_LOG=false`).
- Prod exige `https:///wss://`, falla rápido si se configura `http://`.
- 403 no renueva ni limpia sesión; 401 con 2º fallo limpia y emite `session-expired`.
