// Registro reutilizable del mock de `expo-secure-store`.
//
// `vi.mock` es *hoisted* al tope del archivo de test por Vitest, así que la forma
// robusta de reutilizarlo es exponer un helper que los tests llaman en su cima.
// Debido al hoisting, el factory de `vi.mock` no puede referenciar variables externas
// no-hoisted; por eso el factory importa el módulo de memoria de forma perezosa.
//
// Uso desde un archivo de test:
//
//   import { mockSecureStore } from '@/test/helpers/mock-secure-store';  // (import relativo)
//   const store = mockSecureStore();   // llamar en la cima del módulo de test
//
//   beforeEach(() => store.resetSecureStore());
//
//   it('...', async () => {
//     store.seed({ auth_token: 'abc' });
//     // ... código bajo test que importa 'expo-secure-store'
//   });
//
// El objeto devuelto son los helpers de control del mock en memoria
// (resetSecureStore, peek, has, size, seed, failNext*, failAllOperations).

import { vi } from 'vitest';
import * as memoryStore from '../../lib/__mocks__/secure-store-memory';

/**
 * Registra `vi.mock('expo-secure-store', ...)` apuntando al mock en memoria y
 * devuelve los helpers de control para preparar/inspeccionar el almacenamiento.
 *
 * Nota: `vi.mock` se eleva (hoist) al inicio del módulo, por lo que esta llamada
 * surte efecto para todo el archivo de test aunque aparezca dentro del cuerpo.
 */
export function mockSecureStore(): typeof memoryStore {
  vi.mock('expo-secure-store', async () => {
    const mod = await import('../../lib/__mocks__/secure-store-memory');
    return mod.secureStoreMock;
  });
  return memoryStore;
}
