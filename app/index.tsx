import { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../lib/auth-store';
import { colors, radius, curve } from '../lib/theme';

export default function Home() {
  const router = useRouter();
  const { token, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && token) {
      router.replace('/dashboard');
    }
  }, [isLoading, token, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Marcador
        </Text>
        <Text style={styles.titleOrange}>Ecuavoley</Text>
        <Text style={styles.subtitle}>Arbitraje digital para partidos de ecuavoley</Text>

        <Pressable
          style={styles.btnPrimary}
          onPress={() => router.push('/login')}
          accessibilityRole="button"
          accessibilityLabel="Soy juez, iniciar sesión"
        >
          <Text style={styles.btnText}>Soy juez</Text>
        </Pressable>

        <Pressable
          style={styles.btnSecondary}
          onPress={() => router.push('/espectador')}
          accessibilityRole="button"
          accessibilityLabel="Soy espectador, ver partido"
        >
          <Text style={styles.btnText}>Soy espectador</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 0,
  },
  titleOrange: {
    fontSize: 40,
    fontWeight: 'bold',
    color: colors.spectator,
    marginBottom: 16,
  },
  subtitle: {
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 48,
    fontSize: 16,
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.lg,
    ...curve,
    marginBottom: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  btnSecondary: {
    width: '100%',
    backgroundColor: colors.spectator,
    paddingVertical: 16,
    borderRadius: radius.lg,
    ...curve,
    minHeight: 56,
    justifyContent: 'center',
  },
  btnText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
});
