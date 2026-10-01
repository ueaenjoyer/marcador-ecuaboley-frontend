// Emisor de eventos de sesión.
//
// Desacopla la Capa_API (mobile/lib/api.ts) de Expo Router: la Capa_API no puede
// usar hooks de navegación porque no es un componente React. En su lugar, emite un
// evento de "sesión expirada" que un único suscriptor montado en _layout.tsx
// (que sí tiene acceso a useRouter) escucha para reaccionar navegando.
//
// Principio rector: "el backend decide, la navegación reacciona".

type SessionExpiredListener = () => void;

let listener: SessionExpiredListener | null = null;

/**
 * Registra el manejador de sesión expirada (lo llama _layout.tsx).
 * Solo se mantiene un único listener a la vez.
 * @returns Una función `unsubscribe` que solo desregistra el listener si sigue
 *          siendo `cb` (evita que un unsubscribe tardío borre un listener nuevo).
 */
export function onSessionExpired(cb: SessionExpiredListener): () => void {
  listener = cb;
  return () => {
    if (listener === cb) listener = null;
  };
}

/**
 * Notifica que la sesión expiró (lo llama la Capa_API tras un refresh fallido).
 * No lanza si no hay listener registrado.
 */
export function emitSessionExpired(): void {
  listener?.();
}
