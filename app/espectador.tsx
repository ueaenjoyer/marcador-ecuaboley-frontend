import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { validateCodigoSala } from '../lib/validation';
import { colors, radius, curve } from '../lib/theme';

export default function Espectador() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');

  const handleUnirse = () => {
    const validationError = validateCodigoSala(codigo);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    router.push(`/ver-partido/${codigo.trim().toUpperCase()}`);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <Pressable
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Text style={s.backText}>← Volver</Text>
        </Pressable>

        <Text style={s.title} accessibilityRole="header">
          Modo espectador
        </Text>
        <Text style={s.subtitle}>Ingresa el código de sala que te compartió el juez</Text>

        {error ? (
          <View style={s.errorBox} accessibilityRole="alert">
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={[s.codeInput, error ? s.codeInputError : null]}
          placeholder="ABC123"
          value={codigo}
          onChangeText={(t) => {
            setCodigo(t.toUpperCase());
            if (error) setError('');
          }}
          autoCapitalize="characters"
          maxLength={6}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleUnirse}
          accessibilityLabel="Código de sala"
          accessibilityHint="6 letras o números"
        />
        <Text style={s.hint}>El código tiene 6 letras o números y aparece en el marcador del juez.</Text>

        <Pressable
          style={s.btn}
          onPress={handleUnirse}
          accessibilityRole="button"
          accessibilityLabel="Ver partido"
        >
          <Text style={s.btnText}>Ver partido</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  backBtn: { position: 'absolute', top: 48, left: 32, paddingVertical: 10, minHeight: 44 },
  backText: { color: colors.spectator, fontWeight: '600' },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.spectator,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: { color: colors.muted, textAlign: 'center', marginBottom: 24 },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    borderRadius: radius.sm,
    ...curve,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  codeInput: {
    borderWidth: 2,
    borderColor: colors.spectator,
    borderRadius: radius.md,
    ...curve,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 8,
    minHeight: 64,
  },
  codeInputError: { borderColor: colors.danger },
  hint: { color: colors.faint, fontSize: 12, textAlign: 'center', marginBottom: 24 },
  btn: {
    backgroundColor: colors.spectator,
    paddingVertical: 16,
    borderRadius: radius.md,
    ...curve,
    minHeight: 54,
    justifyContent: 'center',
  },
  btnText: { color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' },
});
