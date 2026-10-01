// Mock en memoria de `expo-secure-store` para tests con Vitest (environment: 'node').
//
// Reemplaza `setItemAsync` / `getItemAsync` / `deleteItemAsync` por una implementación
// respaldada por un `Map`, sin tocar el módulo nativo. Permite:
//   - resetear el almacenamiento entre tests (`resetSecureStore`)
//   - forzar fallos en cualquiera de las operaciones (`failNextSet` / `failNextGet` /
//     `failNextDelete` o `failAllOperations`), necesario para los escenarios de
//     fallo de escritura/lectura/borrado (Req 1.6, 3.6).
//
// Uso típico desde un test:
//   import * as memoryStore from '@/lib/__mocks__/secure-store-memory';  // (import relativo)
//   vi.mock('expo-secure-store', () => memoryStore.secureStoreMock);
//   beforeEach(() => memoryStore.resetSecureStore());

/**
 * Almacenamiento en memoria. Clave -> valor string, igual que SecureStore real
 * (que solo guarda strings). No se expone directamente; usar los helpers.
 */
const store = new Map<string, string>();

/**
 * Contadores y flags para controlar fallos forzados. Cada flag numérico indica
 * cuántas de las próximas llamadas de ese tipo deben rechazar. `-1` = fallar siempre.
 */
interface FailureControl {
  set: number;
  get: number;
  delete: number;
}

const failures: FailureControl = { set: 0, get: 0, delete: 0 };

/** Error que emula un rechazo nativo de SecureStore. */
export class SecureStoreMockError extends Error {
  constructor(operation: string) {
    super(`SecureStore mock forced failure on ${operation}`);
    this.name = 'SecureStoreMockError';
  }
}

/** Decrementa/consulta un contador de fallos; devuelve true si esta llamada debe fallar. */
function shouldFail(kind: keyof FailureControl): boolean {
  const remaining = failures[kind];
  if (remaining === 0) return false;
  if (remaining > 0) failures[kind] = remaining - 1;
  // remaining < 0 => fallar siempre; no se decrementa.
  return true;
}

/** Guarda un valor. Rechaza si se forzó un fallo de `set`. */
export async function setItemAsync(key: string, value: string): Promise<void> {
  if (shouldFail('set')) throw new SecureStoreMockError('setItemAsync');
  store.set(key, value);
}

/** Lee un valor; devuelve `null` si no existe. Rechaza si se forzó un fallo de `get`. */
export async function getItemAsync(key: string): Promise<string | null> {
  if (shouldFail('get')) throw new SecureStoreMockError('getItemAsync');
  return store.has(key) ? (store.get(key) as string) : null;
}

/** Borra una clave. Rechaza si se forzó un fallo de `delete`. */
export async function deleteItemAsync(key: string): Promise<void> {
  if (shouldFail('delete')) throw new SecureStoreMockError('deleteItemAsync');
  store.delete(key);
}

// ---------------------------------------------------------------------------
// Helpers de control para los tests (no forman parte de la API de SecureStore).
// ---------------------------------------------------------------------------

/** Vacía el almacenamiento y limpia todos los fallos forzados. Llamar en `beforeEach`. */
export function resetSecureStore(): void {
  store.clear();
  failures.set = 0;
  failures.get = 0;
  failures.delete = 0;
}

/** Lee directamente el valor almacenado (para aserciones), sin pasar por los flags de fallo. */
export function peek(key: string): string | null {
  return store.has(key) ? (store.get(key) as string) : null;
}

/** Devuelve true si la clave existe en el almacenamiento. */
export function has(key: string): boolean {
  return store.has(key);
}

/** Cantidad de claves almacenadas (para aserciones de "sesión vacía"). */
export function size(): number {
  return store.size;
}

/** Precarga el almacenamiento con pares clave/valor (para preparar un test). */
export function seed(entries: Record<string, string>): void {
  for (const [k, v] of Object.entries(entries)) store.set(k, v);
}

/** Fuerza que las próximas `count` llamadas a `setItemAsync` rechacen (default 1). */
export function failNextSet(count = 1): void {
  failures.set = count;
}

/** Fuerza que las próximas `count` llamadas a `getItemAsync` rechacen (default 1). */
export function failNextGet(count = 1): void {
  failures.get = count;
}

/** Fuerza que las próximas `count` llamadas a `deleteItemAsync` rechacen (default 1). */
export function failNextDelete(count = 1): void {
  failures.delete = count;
}

/** Fuerza que TODAS las operaciones subsiguientes rechacen hasta el próximo reset. */
export function failAllOperations(): void {
  failures.set = -1;
  failures.get = -1;
  failures.delete = -1;
}

/**
 * Objeto con la forma del módulo `expo-secure-store` (solo las funciones usadas por
 * la feature). Pasar a `vi.mock('expo-secure-store', () => secureStoreMock)`.
 */
export const secureStoreMock = {
  setItemAsync,
  getItemAsync,
  deleteItemAsync,
};
