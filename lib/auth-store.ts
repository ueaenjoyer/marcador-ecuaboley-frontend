import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  email: string;
  nombre: string;
  role: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  setAuth: (token: string, refreshToken: string, user: User) => void;
  updateAccessToken: (token: string) => void;
  clearSession: () => void;
  logout: () => void;
  loadToken: () => Promise<void>;
}

// Valida que un valor arbitrario (resultado de JSON.parse) corresponda a un
// User válido: objeto con id, email, nombre y role de tipo string (Req 1.7).
function isValidUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.nombre === 'string' &&
    typeof candidate.role === 'string'
  );
}

// Limpieza compartida por clearSession y logout: vacía la memoria PRIMERO y
// luego intenta borrar las claves de SecureStore dentro de try/catch, de modo
// que un fallo de borrado no deje la sesión colgada en memoria (Req 3.1, 3.6).
async function clearStoredSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_refresh_token');
    await SecureStore.deleteItemAsync('auth_user');
  } catch {
    // El estado en memoria ya quedó vacío; ignoramos el fallo de borrado.
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  user: null,
  isLoading: true,

  setAuth: (token, refreshToken, user) => {
    SecureStore.setItemAsync('auth_token', token);
    SecureStore.setItemAsync('auth_refresh_token', refreshToken);
    SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    set({ token, refreshToken, user, isLoading: false });
  },

  updateAccessToken: (token) => {
    SecureStore.setItemAsync('auth_token', token);
    set({ token });
  },

  clearSession: () => {
    set({ token: null, refreshToken: null, user: null });
    void clearStoredSession();
  },

  logout: () => {
    set({ token: null, refreshToken: null, user: null, isLoading: false });
    void clearStoredSession();
  },

  loadToken: async () => {
    let token: string | null;
    let refreshToken: string | null;
    let userStr: string | null;

    // Lectura de las 3 claves. Un fallo de SecureStore deja sesión vacía
    // pero siempre finaliza la carga (Req 1.6).
    try {
      token = await SecureStore.getItemAsync('auth_token');
      refreshToken = await SecureStore.getItemAsync('auth_refresh_token');
      userStr = await SecureStore.getItemAsync('auth_user');
    } catch {
      set({ token: null, refreshToken: null, user: null, isLoading: false });
      return;
    }

    // Sin Access_Token no hay sesión que cargar (Req 1.3, flowchart).
    if (!token || !userStr) {
      set({ token: null, refreshToken: null, user: null, isLoading: false });
      return;
    }

    // El usuario debe parsear a un User válido; si no, se descarta la sesión
    // completa (Req 1.7).
    let user: User;
    try {
      const parsed: unknown = JSON.parse(userStr);
      if (!isValidUser(parsed)) {
        set({ token: null, refreshToken: null, user: null, isLoading: false });
        return;
      }
      user = parsed;
    } catch {
      set({ token: null, refreshToken: null, user: null, isLoading: false });
      return;
    }

    // Access_Token + usuario válido. El refresh token puede estar ausente:
    // se carga como null y el arranque continúa (Req 1.5).
    set({ token, refreshToken: refreshToken ?? null, user, isLoading: false });
  },
}));
