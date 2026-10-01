// Notificaciones push para espectadores (expo-notifications).
// El permiso se solicita solo al activar "Recibir avisos de sets".
// Un fallo aquí nunca bloquea la sala: Socket.io sigue siendo la fuente en vivo.

import { Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../api';
import { getStoredPushToken, setStoredPushToken, setAvisosPreference } from './preferences';
import type { PermissionState } from './permission-types';

const AVISOS_CHANNEL_ID = 'avisos-partido';

const mapStatus = (status: string): PermissionState['status'] => {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
};

export const getPermissionState = async (): Promise<PermissionState> => {
  const permissions = await Notifications.getPermissionsAsync();
  return {
    status: mapStatus(permissions.status),
    canAskAgain: permissions.canAskAgain,
  };
};

export const requestPermission = async (): Promise<PermissionState> => {
  if (Platform.OS === 'android') {
    // Android 13+ no muestra el diálogo hasta que existe al menos un canal.
    await Notifications.setNotificationChannelAsync(AVISOS_CHANNEL_ID, {
      name: 'Avisos del partido',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const permissions = await Notifications.requestPermissionsAsync();
  return {
    status: mapStatus(permissions.status),
    canAskAgain: permissions.canAskAgain,
  };
};

const getExpoPushToken = async (): Promise<string> => {
  const cached = await getStoredPushToken();
  if (cached) return cached;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error(
      'Falta configurar el proyecto EAS (projectId). Ejecuta "eas init" para habilitar los avisos.',
    );
  }

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await setStoredPushToken(data);
  return data;
};

export const subscribeToPartido = async (codigoSala: string): Promise<void> => {
  const expoPushToken = await getExpoPushToken();
  await api.post(`/partidos/sala/${codigoSala}/notificaciones`, { expoPushToken });
  await setAvisosPreference(codigoSala, true);
};

export const unsubscribeFromPartido = async (codigoSala: string): Promise<void> => {
  await setAvisosPreference(codigoSala, false);
  const expoPushToken = await getStoredPushToken();
  if (!expoPushToken) return;
  await api.post(`/partidos/sala/${codigoSala}/notificaciones/desuscribir`, { expoPushToken });
};

export const openSettings = (): void => {
  void Linking.openSettings();
};
