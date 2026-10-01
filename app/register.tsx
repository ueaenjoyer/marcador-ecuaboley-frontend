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
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../lib/api';
import { colors, radius, curve, touch } from '../lib/theme';
import { useAuthStore } from '../lib/auth-store';
import { getRegisterFieldErrors, type RegisterFieldErrors } from '../lib/validation';

interface RegisterResponse {
  usuario: { id: string; email: string; nombre: string; role: string };
  accessToken: string;
  refreshToken: string;
}

// Timeout de la petición de registro (Req 6.3): si no hay respuesta en 10 s,
// se resuelve el race con un símbolo de timeout y se muestra "no conexión".
const REQUEST_TIMEOUT_MS = 10_000;
const TIMEOUT = Symbol('timeout');

export default function Register() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const errors = getRegisterFieldErrors(nombre, email, password);
    setFieldErrors(errors);
    if (errors.nombre ?? errors.email ?? errors.password) {
      setError(errors.nombre ?? errors.email ?? errors.password ?? '');
      return;
    }
    // Limpiar el mensaje de error anterior antes de reenviar (Req 6.5).
    setError('');
    Keyboard.dismiss();
    setLoading(true);

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Race entre la petición y un timeout de 10 s (Req 6.3).
      const timeout = new Promise<typeof TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT), REQUEST_TIMEOUT_MS);
      });
      const result = await Promise.race([
        api.post<RegisterResponse>('/auth/register', {
          email: email.trim(),
          password,
          nombre: nombre.trim(),
        }),
        timeout,
      ]);

      if (result === TIMEOUT) {
        // Sin respuesta en 10 s: conservar campos, vaciar solo password (Req 6.3).
        setPassword('');
        setError('No se pudo conectar al servidor.');
        return;
      }

      setAuth(result.accessToken, result.refreshToken, result.usuario);
      router.replace('/dashboard');
    } catch (err) {
      // ApiError o error de red: conservar nombre y email, vaciar solo
      // la contraseña; mostrar el mensaje del error (Req 6.1, 6.2).
      setPassword('');
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo conectar al servidor.');
    } finally {
      if (timer) clearTimeout(timer);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        <View style={s.content}>
          <Text style={s.title} accessibilityRole="header">
            Crear cuenta
          </Text>
          <Text style={s.subtitle}>Regístrate como juez para arbitrar partidos</Text>

          {error ? (
            <View style={s.errorBox} accessibilityRole="alert">
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={s.label}>Nombre</Text>
          <TextInput
            style={[s.input, fieldErrors.nombre ? s.inputError : null]}
            placeholder="Tu nombre"
            value={nombre}
            onChangeText={(value) => {
              setNombre(value);
              if (fieldErrors.nombre) setFieldErrors((prev) => ({ ...prev, nombre: undefined }));
            }}
            autoCapitalize="words"
            returnKeyType="next"
            textContentType="name"
            accessibilityLabel="Nombre"
            accessibilityHint="Mínimo 2 caracteres"
          />
          {fieldErrors.nombre ? (
            <Text style={s.fieldError} accessibilityRole="alert">
              {fieldErrors.nombre}
            </Text>
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
              textContentType="newPassword"
              onSubmitEditing={handleRegister}
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
            onPress={handleRegister}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Registrarme"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color="white" accessibilityLabel="Creando cuenta" />
            ) : (
              <Text style={s.btnText}>Registrarme</Text>
            )}
          </Pressable>

          <View style={s.linkRow}>
            <Text style={s.linkLabel}>¿Ya tienes cuenta? </Text>
            <Link href="/login" style={s.link} accessibilityRole="link">
              Inicia sesión
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
