import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../lib/api';
import { colors, radius, curve, touch } from '../lib/theme';
import { useAuthStore } from '../lib/auth-store';
import { getLoginFieldErrors, type LoginFieldErrors } from '../lib/validation';

interface LoginResponse {
  usuario: { id: string; email: string; nombre: string; role: string };
  accessToken: string;
  refreshToken: string;
}

// Timeout de la petición de login (Req 6.3).
const LOGIN_TIMEOUT_MS = 10_000;

// Error interno para distinguir el vencimiento del timeout de un ApiError.
class LoginTimeoutError extends Error {}

export default function Login() {
  const router = useRouter();
  const { expired } = useLocalSearchParams<{ expired?: string }>();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const errors = getLoginFieldErrors(email, password);
    setFieldErrors(errors);
    if (errors.email ?? errors.password) {
      setError(errors.email ?? errors.password ?? '');
      return;
    }
    // Limpiar el error anterior antes de reenviar (Req 6.5).
    setError('');
    Keyboard.dismiss();
    setLoading(true);

    // La Capa_API no expone timeout para peticiones normales; se aplica aquí
    // corriendo el login contra un temporizador de 10 s (Req 6.3).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new LoginTimeoutError()), LOGIN_TIMEOUT_MS);
    });

    try {
      const data = await Promise.race([
        api.post<LoginResponse>('/auth/login', { email: email.trim(), password }),
        timeout,
      ]);
      setAuth(data.accessToken, data.refreshToken, data.usuario);
      router.replace('/dashboard');
    } catch (err) {
      // Ante cualquier error: conservar el email y vaciar solo la
      // contraseña (Req 6.1); mostrar el mensaje correspondiente (Req 6.2).
      setPassword('');
      if (err instanceof LoginTimeoutError) {
        setError('No se pudo conectar al servidor. Verifica tu conexión e intenta de nuevo.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo conectar al servidor.');
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        <View style={s.content}>
          <Text style={s.title} accessibilityRole="header">
            Iniciar sesión
          </Text>
          <Text style={s.subtitle}>Ingresa como juez para gestionar partidos</Text>

          {expired ? (
            <View style={s.noticeBox} accessibilityRole="alert">
              <Text style={s.noticeText}>
                Tu sesión expiró. Inicia sesión nuevamente para continuar.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={s.errorBox} accessibilityRole="alert">
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={s.label}>Email</Text>
          <TextInput
            style={[s.input, fieldErrors.email ? s.inputError : null]}
            placeholder="juez@email.com"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            textContentType="emailAddress"
            accessibilityLabel="Email"
            accessibilityHint="Ingresa tu correo de juez"
          />
          {fieldErrors.email ? (
            <Text style={s.fieldError} accessibilityRole="alert">
              {fieldErrors.email}
            </Text>
          ) : null}

          <Text style={s.label}>Contraseña</Text>
          <View style={s.passwordRow}>
            <TextInput
              style={[s.input, s.passwordInput, fieldErrors.password ? s.inputError : null]}
              placeholder="Mín. 6 caracteres"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (fieldErrors.password)
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              textContentType="password"
              onSubmitEditing={handleLogin}
              accessibilityLabel="Contraseña"
              accessibilityHint="Mínimo 6 caracteres"
            />
            <Pressable
              style={s.toggleBtn}
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              <Text style={s.toggleText}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
            </Pressable>
          </View>
          {fieldErrors.password ? (
            <Text style={s.fieldError} accessibilityRole="alert">
              {fieldErrors.password}
            </Text>
          ) : null}

          <Pressable
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Entrar"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color="white" accessibilityLabel="Iniciando sesión" />
            ) : (
              <Text style={s.btnText}>Entrar</Text>
            )}
          </Pressable>

          <View style={s.linkRow}>
            <Text style={s.linkLabel}>¿No tienes cuenta? </Text>
            <Link href="/register" style={s.link} accessibilityRole="link">
              Regístrate
            </Link>
          </View>

          <Pressable
            onPress={() => router.back()}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Text style={s.backText}>Volver</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.primary, marginBottom: 4 },
  subtitle: { color: colors.faint, marginBottom: 24 },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    borderRadius: radius.sm,
    ...curve,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: colors.danger, fontSize: 13 },
  noticeBox: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningLine,
    borderRadius: radius.sm,
    ...curve,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: { color: colors.warning, fontSize: 13 },
  label: { color: colors.ink, fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: radius.md,
    ...curve,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
    backgroundColor: 'white',
    fontSize: 16,
    minHeight: 48,
  },
  inputError: { borderColor: '#DC2626', borderWidth: 2 },
  fieldError: { color: colors.danger, fontSize: 12, marginBottom: 12, marginTop: 4 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passwordInput: { flex: 1, marginBottom: 4 },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    ...curve,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'white',
    minHeight: 48,
    justifyContent: 'center',
  },
  toggleText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    ...curve,
    marginTop: 16,
    minHeight: 52,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  linkLabel: { color: colors.muted },
  link: { color: colors.primary, fontWeight: '600' },
  backBtn: { marginTop: 16, paddingVertical: 8 },
  backText: { color: colors.faint, textAlign: 'center' },
});
