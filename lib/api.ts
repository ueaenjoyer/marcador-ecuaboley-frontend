import { useAuthStore } from './auth-store';
import { emitSessionExpired } from './session-events';
import {
  BASE_URL,
  ENABLE_HTTP_LOG,
  RESPONSE_TIMEOUT_MS,
  REFRESH_TIMEOUT_MS,
  RETRY_MAX_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
} from './config';

// Cliente HTTP único del Prototipo 13 (fetch nativo).
// Orden de interceptores: log → inject-token → fetch+timeout → validate-status
// → refresh-401(single-flight, 1 reintento, marca anti-bucle) → 403 passthrough.
// El log oculta Authorization y solo está activo en desarrollo.

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method: HttpMethod;
  path: string;
  body?: unknown;
  signal?: AbortSignal;
  // Interno: indica que esta ejecución ya es un reintento post-refresh.
  // Evita una segunda renovación si el reintento vuelve a dar 401.
  alreadyRetried?: boolean;
}

// ---------------------------------------------------------------------------
// Refresh single-flight
// ---------------------------------------------------------------------------

let refreshInFlight: Promise<string> | null = null;

async function ensureRefresh(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function doRefresh(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) throw new ApiError('Sesión no disponible', 401);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (!res.ok) {
      throw new ApiError(json.error?.message ?? 'Refresh falló', res.status, json.error?.code);
    }
    useAuthStore.getState().updateAccessToken(json.data.accessToken);
    return json.data.accessToken as string;
  } catch (err) {
    useAuthStore.getState().clearSession();
    emitSessionExpired();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Helpers de red: timeout, log, dominio, reintento
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const isTimeoutError = (err: unknown): boolean =>
  err instanceof Error && err.name === 'AbortError';

export const isNetworkError = (err: unknown): boolean =>
  err instanceof TypeError && /network|fetch|failed|load failed/i.test(err.message);

const isRetriableStatus = (status: number): boolean => status >= 500 && status <= 599;

const shouldRetryGet = (err: unknown): boolean => {
  if (isTimeoutError(err) || isNetworkError(err)) return true;
  if (err instanceof ApiError && isRetriableStatus(err.status)) return true;
  return false;
};

// Cuatro familias de fallo de red → mensajes comprensibles del dominio.
export const toDomainMessage = (err: unknown): string => {
  if (isTimeoutError(err)) return 'El servidor tarda demasiado. Revisa tu WiFi e inténtalo de nuevo.';
  if (isNetworkError(err)) return 'Sin conexión al marcador. Sigues viendo el último estado guardado.';
  if (err instanceof ApiError) {
    if (err.status >= 500) return 'El servidor falló. No se aplicó ningún cambio.';
    if (err.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    if (err.status === 403) return permisoMensaje(err);
    if (err.message?.trim()) return err.message;
  }
  if (err instanceof Error && err.message?.trim()) return err.message;
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
};

const logRequest = (method: string, path: string): void => {
  if (ENABLE_HTTP_LOG) console.log(`[api] ${method} ${path}`);
};

const logResponse = (method: string, path: string, status: number): void => {
  if (ENABLE_HTTP_LOG) console.log(`[api] ${method} ${path} -> ${status}`);
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  if (externalSignal?.aborted) controller.abort();
  const onExternalAbort = (): void => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

// ---------------------------------------------------------------------------
// Request unificado
// ---------------------------------------------------------------------------

async function request<T>(opts: RequestOptions, attempt = 0): Promise<T> {
  const { method, path, body, alreadyRetried, signal } = opts;

  const token = useAuthStore.getState().token;
  const isDelete = method === 'DELETE';
  const hasBody = body !== undefined && body !== null;
  const isIdempotentGet = method === 'GET';

  logRequest(method, path);

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${BASE_URL}${path}`,
      {
        method,
        headers: {
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: hasBody ? JSON.stringify(body) : undefined,
      },
      RESPONSE_TIMEOUT_MS,
      signal,
    );
  } catch (err) {
    // Cancelación por el usuario (abandona pantalla): no reintentar, propagar tal cual.
    if (signal?.aborted || isTimeoutError(err)) {
      if (isTimeoutError(err) && !signal?.aborted) {
        const timeoutErr = new ApiError(
          'El servidor tarda demasiado. Revisa tu WiFi e inténtalo de nuevo.',
          408,
          'TIMEOUT',
        );
        if (isIdempotentGet && attempt < RETRY_MAX_ATTEMPTS) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
          return request<T>(opts, attempt + 1);
        }
        throw timeoutErr;
      }
      throw err;
    }
    // Reintento solo idempotente (GET) con espera creciente; POST punto/undo jamás.
    if (isIdempotentGet && attempt < RETRY_MAX_ATTEMPTS && shouldRetryGet(err)) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      return request<T>(opts, attempt + 1);
    }
    if (isNetworkError(err)) {
      throw new ApiError(
        'Sin conexión al marcador. Sigues viendo el último estado guardado.',
        0,
        'NETWORK_ERROR',
      );
    }
    throw err;
  }

  logResponse(method, path, res.status);

  if (res.ok) {
    if (isDelete) return undefined as T;
    const json = await res.json();
    return json.data as T;
  }

  if (res.status === 401 && !alreadyRetried) {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      const json = await res.json().catch(() => ({}));
      throw new ApiError(json.error?.message ?? 'No autorizado', 401, json.error?.code);
    }
    await ensureRefresh();
    return request<T>({ ...opts, alreadyRetried: true }, attempt);
  }

  if (res.status === 401 && alreadyRetried) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(json.error?.message ?? 'No autorizado', 401, json.error?.code);
  }

  if (res.status === 403) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(json.error?.message ?? 'Sin permiso', 403, json.error?.code);
  }

  // Reintento GET ante 5xx con espera creciente.
  if (isIdempotentGet && isRetriableStatus(res.status) && attempt < RETRY_MAX_ATTEMPTS) {
    await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    return request<T>(opts, attempt + 1);
  }

  const json = await res.json().catch(() => ({}));
  throw new ApiError(json.error?.message ?? 'Error desconocido', res.status, json.error?.code);
}

export interface CallOptions {
  signal?: AbortSignal;
}

export const api = {
  get: <T>(path: string, opts?: CallOptions): Promise<T> =>
    request<T>({ method: 'GET', path, signal: opts?.signal }),
  post: <T>(path: string, body?: unknown, opts?: CallOptions): Promise<T> =>
    request<T>({ method: 'POST', path, body, signal: opts?.signal }),
  patch: <T>(path: string, body?: unknown, opts?: CallOptions): Promise<T> =>
    request<T>({ method: 'PATCH', path, body, signal: opts?.signal }),
  delete: (path: string, opts?: CallOptions): Promise<void> =>
    request<void>({ method: 'DELETE', path, signal: opts?.signal }),
};

// ---------------------------------------------------------------------------
// Helpers de clasificación
// ---------------------------------------------------------------------------

export function isForbidden(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export function permisoMensaje(err: ApiError): string {
  return err.message?.trim() ? err.message : 'No tienes permiso para realizar esta acción.';
}
