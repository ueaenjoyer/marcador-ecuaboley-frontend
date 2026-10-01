// Helper de mock de `fetch` para tests de la Capa_API con Vitest (environment: 'node').
//
// Permite:
//   - encolar respuestas por path (status + body JSON), consumidas en orden FIFO
//     (para simular la secuencia 401 -> refresh 200 -> reintento 200, etc.)
//   - contar llamadas por path (para verificar single-flight del refresh y el número
//     de reintentos — P4, P5)
//   - simular timeout (rechazo con AbortError cuando el caller usa AbortController,
//     Req 2.7) y rechazo de red genérico (Req 6.3, P8)
//
// No depende de un runtime de navegador: construye objetos con la forma mínima de
// `Response` que consume `mobile/lib/api.ts` (`ok`, `status`, `json()`).
//
// Uso típico:
//   import { createFetchMock } from '@/test/helpers/fetch-mock';  // (import relativo)
//   const fetchMock = createFetchMock();
//   vi.stubGlobal('fetch', fetchMock.fetch);
//   fetchMock.enqueue('/partidos/1/punto', { status: 401 });
//   fetchMock.enqueue('/auth/refresh', { status: 200, body: { data: { accessToken: 'nuevo' } } });
//   fetchMock.enqueue('/partidos/1/punto', { status: 200, body: { data: { marcador: 1 } } });
//   ...
//   expect(fetchMock.countFor('/auth/refresh')).toBe(1);

/** Objeto mínimo con la forma de `Response` que la Capa_API consume. */
export interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

/** Cómo debe comportarse una respuesta encolada. */
export interface EnqueuedResponse {
  /** Código HTTP. `ok` se deriva como `status >= 200 && status < 300`. */
  status?: number;
  /** Cuerpo que devolverá `res.json()`. Default `{}`. */
  body?: unknown;
  /**
   * Modo de fallo en lugar de responder:
   *   - 'timeout': rechaza con un AbortError (emula que venció el AbortController).
   *   - 'network': rechaza con un TypeError de red genérico.
   */
  fail?: 'timeout' | 'network';
}

/** Registro de una llamada recibida, para inspección en aserciones. */
export interface RecordedCall {
  path: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

/** Error con `name === 'AbortError'`, como el que produce un fetch abortado. */
export class AbortError extends Error {
  constructor(message = 'The operation was aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

export interface FetchMock {
  /** La función a inyectar vía `vi.stubGlobal('fetch', fetchMock.fetch)` o similar. */
  fetch: (input: string | URL, init?: RequestInit) => Promise<MockResponse>;
  /** Encola una respuesta para el `path` dado (se consumen en orden FIFO). */
  enqueue: (path: string, response?: EnqueuedResponse) => void;
  /** Encola varias respuestas para el mismo `path`. */
  enqueueMany: (path: string, responses: EnqueuedResponse[]) => void;
  /** Fija una respuesta por defecto para cualquier path sin cola específica. */
  setDefault: (response: EnqueuedResponse) => void;
  /** Número de llamadas recibidas para un `path` concreto. */
  countFor: (path: string) => number;
  /** Número total de llamadas recibidas. */
  totalCalls: () => number;
  /** Todas las llamadas registradas, en orden. */
  calls: () => RecordedCall[];
  /** Limpia colas, contadores y registro de llamadas. Llamar en `beforeEach`. */
  reset: () => void;
}

/**
 * Extrae el `path` de una URL absoluta o relativa, quitando el origen y el query string.
 * Ej.: 'http://localhost:3000/api/auth/refresh?x=1' -> '/auth/refresh' cuando basePrefix
 * incluye '/api'. Como el BASE_URL de la app termina en '/api', normalizamos quitando
 * ese prefijo para que las claves sean como '/auth/refresh', '/partidos/1/punto'.
 */
function extractPath(rawUrl: string, apiPrefix: string): string {
  let path = rawUrl;
  // Quitar esquema+host si es URL absoluta.
  const schemeIdx = path.indexOf('://');
  if (schemeIdx !== -1) {
    const afterScheme = path.slice(schemeIdx + 3);
    const slashIdx = afterScheme.indexOf('/');
    path = slashIdx === -1 ? '/' : afterScheme.slice(slashIdx);
  }
  // Quitar query string / fragmento.
  path = path.split('?')[0].split('#')[0];
  // Quitar el prefijo del API si está presente.
  if (apiPrefix && path.startsWith(apiPrefix)) {
    path = path.slice(apiPrefix.length) || '/';
  }
  return path;
}

function buildResponse(spec: EnqueuedResponse): MockResponse {
  const status = spec.status ?? 200;
  const body = spec.body ?? {};
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/**
 * Crea un mock de `fetch`.
 * @param apiPrefix prefijo a recortar de la URL para calcular el `path` (default '/api',
 *   que coincide con el BASE_URL de `mobile/lib/api.ts`). Pasar '' para no recortar nada.
 */
export function createFetchMock(apiPrefix = '/api'): FetchMock {
  const queues = new Map<string, EnqueuedResponse[]>();
  const counts = new Map<string, number>();
  const recorded: RecordedCall[] = [];
  let defaultResponse: EnqueuedResponse | null = null;

  function normalizeHeaders(init?: RequestInit): Record<string, string> {
    const out: Record<string, string> = {};
    const h = init?.headers;
    if (!h) return out;
    if (h instanceof Headers) {
      h.forEach((value, key) => {
        out[key] = value;
      });
    } else if (Array.isArray(h)) {
      for (const [key, value] of h) out[key] = value as string;
    } else {
      Object.assign(out, h as Record<string, string>);
    }
    return out;
  }

  function parseBody(init?: RequestInit): unknown {
    const b = init?.body;
    if (typeof b !== 'string') return b;
    try {
      return JSON.parse(b);
    } catch {
      return b;
    }
  }

  const fetch = async (input: string | URL, init?: RequestInit): Promise<MockResponse> => {
    const rawUrl = typeof input === 'string' ? input : input.toString();
    const path = extractPath(rawUrl, apiPrefix);

    counts.set(path, (counts.get(path) ?? 0) + 1);
    recorded.push({
      path,
      url: rawUrl,
      method: (init?.method ?? 'GET').toUpperCase(),
      headers: normalizeHeaders(init),
      body: parseBody(init),
    });

    const queue = queues.get(path);
    const spec = queue && queue.length > 0 ? queue.shift() : defaultResponse ?? undefined;

    if (!spec) {
      throw new Error(
        `fetch-mock: no hay respuesta encolada para "${path}" (url: ${rawUrl}). ` +
          `Encolá una con enqueue('${path}', ...) o definí un default con setDefault(...).`,
      );
    }

    // Simular fallos que rechazan la promesa de fetch.
    if (spec.fail === 'timeout') {
      // Emula el AbortController venciendo: si hay signal, respetamos su estado.
      throw new AbortError();
    }
    if (spec.fail === 'network') {
      throw new TypeError('Network request failed');
    }

    return buildResponse(spec);
  };

  return {
    fetch,
    enqueue(path, response = {}) {
      const q = queues.get(path) ?? [];
      q.push(response);
      queues.set(path, q);
    },
    enqueueMany(path, responses) {
      const q = queues.get(path) ?? [];
      q.push(...responses);
      queues.set(path, q);
    },
    setDefault(response) {
      defaultResponse = response;
    },
    countFor(path) {
      return counts.get(path) ?? 0;
    },
    totalCalls() {
      return recorded.length;
    },
    calls() {
      return [...recorded];
    },
    reset() {
      queues.clear();
      counts.clear();
      recorded.length = 0;
      defaultResponse = null;
    },
  };
}
