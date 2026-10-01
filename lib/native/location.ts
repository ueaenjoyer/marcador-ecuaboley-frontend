// Ubicación aproximada de la cancha (expo-location, solo foreground).
// El permiso se solicita al activar "Guardar ubicación" en Crear partido.
// Si algo falla (permiso, GPS, geocoding), la creación del partido continúa.

import { Linking } from 'react-native';
import * as Location from 'expo-location';
import type { PermissionState } from './permission-types';

export interface UbicacionCancha {
  latitud: number;
  longitud: number;
  ubicacionTexto: string;
}

const mapStatus = (status: string): PermissionState['status'] => {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
};

export const getPermissionState = async (): Promise<PermissionState> => {
  const permissions = await Location.getForegroundPermissionsAsync();
  return {
    status: mapStatus(permissions.status),
    canAskAgain: permissions.canAskAgain,
  };
};

export const requestPermission = async (): Promise<PermissionState> => {
  const permissions = await Location.requestForegroundPermissionsAsync();
  return {
    status: mapStatus(permissions.status),
    canAskAgain: permissions.canAskAgain,
  };
};

export const hasServicesEnabled = async (): Promise<boolean> => {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
};

export const getLocationWithAddress = async (): Promise<UbicacionCancha> => {
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = position.coords;

  let ubicacionTexto = 'Ubicación no disponible';
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const partes = [address?.street, address?.district, address?.city].filter(Boolean);
    ubicacionTexto = partes.length > 0 ? partes.join(', ') : ubicacionTexto;
  } catch {
    // Sin red o sin geocoder: se conservan solo las coordenadas.
  }

  return { latitud: latitude, longitud: longitude, ubicacionTexto };
};

export const openSettings = (): void => {
  void Linking.openSettings();
};
