// Config centralizada del Prototipo 13 (único lugar con la URL base).
//
// - Dev: usa EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SOCKET_URL si existen,
//   si no cae al IP local de la PC (misma WiFi que el celular).
// - Prod: exige HTTPS y desactiva el log detallado.
// - Tiempos de espera explícitos para conexión y respuesta (10s).

const DEV_API_FALLBACK = 'http://192.168.101.9:3000/api';
const DEV_SOCKET_FALLBACK = 'http://192.168.101.9:3000';

// __DEV__ existe en RN; en Node/Vitest no, se usa NODE_ENV como respaldo.
const isDev: boolean =
  typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

const rawApiUrl: string | undefined = process.env.EXPO_PUBLIC_API_URL;
const rawSocketUrl: string | undefined = process.env.EXPO_PUBLIC_SOCKET_URL;

export const BASE_URL: string = (rawApiUrl ?? DEV_API_FALLBACK).replace(/\/$/, '');
export const SOCKET_URL: string = (rawSocketUrl ?? DEV_SOCKET_FALLBACK).replace(/\/$/, '');

// Producción exige HTTPS (requisito de la guía). Falla rápido si se viola.
if (!isDev) {
  if (!BASE_URL.startsWith('https://')) {
    throw new Error(
      `Config inválida en producción: EXPO_PUBLIC_API_URL debe usar https:// (recibido: ${BASE_URL}).`,
    );
  }
  if (!SOCKET_URL.startsWith('https://') && !SOCKET_URL.startsWith('wss://')) {
    throw new Error(
      `Config inválida en producción: EXPO_PUBLIC_SOCKET_URL debe usar https:///wss:// (recibido: ${SOCKET_URL}).`,
    );
  }
}

export const IS_DEV = isDev;

// Log detallado solo en desarrollo (en prod se desactiva).
export const ENABLE_HTTP_LOG = isDev;

// Tiempos de espera explícitos (ms).
export const CONNECT_TIMEOUT_MS = 10_000;
export const RESPONSE_TIMEOUT_MS = 10_000;
export const REFRESH_TIMEOUT_MS = 10_000;

// Reintentos solo para GET idempotentes, con espera creciente.
export const RETRY_MAX_ATTEMPTS = 2;
export const RETRY_BASE_DELAY_MS = 500;
