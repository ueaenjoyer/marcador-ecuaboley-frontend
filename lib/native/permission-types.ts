// Tipos y helpers compartidos para los cuatro estados de un permiso:
// - undetermined: nunca se preguntó.
// - granted: concedido.
// - denied + canAskAgain: rechazado, se puede volver a preguntar.
// - denied + !canAskAgain: denegación permanente → solo ajustes del sistema.

export type PermissionStatusValue = 'undetermined' | 'granted' | 'denied';

export interface PermissionState {
  status: PermissionStatusValue;
  canAskAgain: boolean;
}

export const isGranted = (state: PermissionState): boolean => state.status === 'granted';

export const canRetry = (state: PermissionState): boolean =>
  state.status === 'denied' && state.canAskAgain;

export const isPermanentlyDenied = (state: PermissionState): boolean =>
  state.status === 'denied' && !state.canAskAgain;
