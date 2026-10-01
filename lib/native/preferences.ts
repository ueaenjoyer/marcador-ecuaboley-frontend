// Persistencia local de la funcionalidad de avisos (SecureStore).
// El token del dispositivo se cachea para no volver a pedirlo a Expo.
// Nunca se registra en consola.

import * as SecureStore from 'expo-secure-store';

const PUSH_TOKEN_KEY = 'push_token';
const AVISOS_PREFIX = 'avisos_sala_';

export const getStoredPushToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredPushToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  } catch {
    // El token se puede volver a obtener; no bloquea la sala.
  }
};

export const getAvisosPreference = async (codigoSala: string): Promise<boolean> => {
  try {
    return (await SecureStore.getItemAsync(AVISOS_PREFIX + codigoSala)) === '1';
  } catch {
    return false;
  }
};

export const setAvisosPreference = async (codigoSala: string, enabled: boolean): Promise<void> => {
  try {
    await SecureStore.setItemAsync(AVISOS_PREFIX + codigoSala, enabled ? '1' : '0');
  } catch {
    // La preferencia es una comodidad; la suscripción ya quedó en el backend.
  }
};
