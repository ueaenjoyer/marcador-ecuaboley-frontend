import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../lib/auth-store';
import { onSessionExpired } from '../lib/session-events';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const loadToken = useAuthStore((s) => s.loadToken);
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);
  const router = useRouter();
  const pathname = usePathname();
  const isRedirecting = useRef(false);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  useEffect(() => {
    if (isLoading) return;

    const isProtectedRoute =
      pathname === '/dashboard' ||
      pathname === '/crear-partido' ||
      pathname.startsWith('/partido/');
    const isAuthenticationRoute = pathname === '/login' || pathname === '/register';

    if ((isAuthenticationRoute && !token) || (pathname === '/dashboard' && token)) {
      isRedirecting.current = false;
    }

    if (isProtectedRoute && !token) {
      if (isRedirecting.current) return;
      isRedirecting.current = true;
      router.replace('/login');
      return;
    }

    if (isAuthenticationRoute && token) {
      if (isRedirecting.current) return;
      isRedirecting.current = true;
      router.replace('/dashboard');
    }
  }, [isLoading, pathname, router, token]);

  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      if (isRedirecting.current) return;
      isRedirecting.current = true;
      router.replace('/login?expired=1'); // Req 3.2, 3.4
    });
    return unsubscribe;
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1E40AF" />
          </View>
        ) : (
          <Slot />
        )}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});
