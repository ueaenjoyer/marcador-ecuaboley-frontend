import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as memoryStore from './__mocks__/secure-store-memory';

vi.mock('expo-secure-store', async () => {
  const mod = await import('./__mocks__/secure-store-memory');
  return mod.secureStoreMock;
});

import { useAuthStore } from './auth-store';

const user = {
  id: 'user-id',
  email: 'user@example.com',
  nombre: 'Ana',
  role: 'JUEZ',
};

const resetSessionState = (): void => {
  useAuthStore.setState({ token: null, refreshToken: null, user: null, isLoading: true });
};

describe('useAuthStore', () => {
  beforeEach(() => {
    memoryStore.resetSecureStore();
    resetSessionState();
  });

  it('persists and restores the complete session', async () => {
    useAuthStore.getState().setAuth('access-token', 'refresh-token', user);

    expect(memoryStore.peek('auth_token')).toBe('access-token');
    expect(memoryStore.peek('auth_refresh_token')).toBe('refresh-token');
    expect(memoryStore.peek('auth_user')).toBe(JSON.stringify(user));

    resetSessionState();
    await useAuthStore.getState().loadToken();

    expect(useAuthStore.getState()).toMatchObject({
      token: 'access-token',
      refreshToken: 'refresh-token',
      user,
      isLoading: false,
    });
  });

  it('loads an access token without a refresh token', async () => {
    memoryStore.seed({ auth_token: 'access-token', auth_user: JSON.stringify(user) });

    await useAuthStore.getState().loadToken();

    expect(useAuthStore.getState()).toMatchObject({
      token: 'access-token',
      refreshToken: null,
      user,
      isLoading: false,
    });
  });

  it('discards a session with an invalid stored user', async () => {
    memoryStore.seed({ auth_token: 'access-token', auth_user: '{invalid-json' });

    await useAuthStore.getState().loadToken();

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      refreshToken: null,
      user: null,
      isLoading: false,
    });
  });

  it('updates only the access token', () => {
    useAuthStore.getState().setAuth('old-access', 'refresh-token', user);

    useAuthStore.getState().updateAccessToken('new-access');

    expect(useAuthStore.getState()).toMatchObject({
      token: 'new-access',
      refreshToken: 'refresh-token',
      user,
    });
    expect(memoryStore.peek('auth_token')).toBe('new-access');
    expect(memoryStore.peek('auth_refresh_token')).toBe('refresh-token');
    expect(memoryStore.peek('auth_user')).toBe(JSON.stringify(user));
  });

  it('clears memory and SecureStore on logout', async () => {
    useAuthStore.getState().setAuth('access-token', 'refresh-token', user);

    useAuthStore.getState().logout();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      refreshToken: null,
      user: null,
      isLoading: false,
    });
    expect(memoryStore.size()).toBe(0);
  });
});
