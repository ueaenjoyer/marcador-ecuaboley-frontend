import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import {
  getPermissionState as getLocationPermissionState,
  requestPermission as requestLocationPermission,
  hasServicesEnabled,
  getLocationWithAddress,
  openSettings as openLocationSettings,
} from '../lib/native/location';
import { isGranted, isPermanentlyDenied } from '../lib/native/permission-types';
import type { PermissionState } from '../lib/native/permission-types';
import type { UbicacionCancha } from '../lib/native/location';
import { colors, radius, curve, touch } from '../lib/theme';
import type { Partido } from '../lib/types';

const COLORES = ['#FF6B00', '#1E40AF', '#DC2626', '#16A34A', '#7C3AED', '#0891B2'];
const COLOR_NOMBRES: Record<string, string> = {
  '#FF6B00': 'Naranja',
  '#1E40AF': 'Azul',
  '#DC2626': 'Rojo',
  '#16A34A': 'Verde',
  '#7C3AED': 'Morado',
  '#0891B2': 'Cyan',
};
const SETS_OPTIONS = [1, 2, 3];

function ColorPicker({
  selected,
  onSelect,
  disabledColor,
  label,
}: {
  selected: string;
  onSelect: (c: string) => void;
  disabledColor?: string;
  label: string;
}) {
  return (
    <View style={s.colorRow}>
      {COLORES.map((color) => {
        const isDisabled = color === disabledColor;
        const nombre = COLOR_NOMBRES[color] ?? color;
        return (
          <Pressable
            key={color}
            style={[
              s.colorDot,
              { backgroundColor: color },
              selected === color && s.colorSelected,
              isDisabled && s.colorDisabled,
            ]}
            onPress={() => !isDisabled && onSelect(color)}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={`${label} color ${nombre}`}
            accessibilityState={{ selected: selected === color, disabled: isDisabled }}
          />
        );
      })}
    </View>
  );
}

export default function CrearPartido() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [nombreA, setNombreA] = useState('');
  const [colorA, setColorA] = useState(COLORES[0]);
  const [nombreB, setNombreB] = useState('');
  const [colorB, setColorB] = useState(COLORES[1]);
  const [puntosObjetivo, setPuntosObjetivo] = useState('15');
  const [setsParaGanar, setSetsParaGanar] = useState(2);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Ubicación opcional de la cancha (Semana 14)
  const [guardarUbicacion, setGuardarUbicacion] = useState(false);
  const [ubicacion, setUbicacion] = useState<UbicacionCancha | null>(null);
  const [ubicacionPermiso, setUbicacionPermiso] = useState<PermissionState | null>(null);
  const [ubicacionMsg, setUbicacionMsg] = useState('');
  const [ubicacionBusy, setUbicacionBusy] = useState(false);

  const activarUbicacionAsync = async () => {
    setUbicacionBusy(true);
    setUbicacionMsg('');
    try {
      let state = await getLocationPermissionState();
      if (!isGranted(state)) {
        state = await requestLocationPermission();
      }
      setUbicacionPermiso(state);
      if (!isGranted(state)) {
        setGuardarUbicacion(false);
        setUbicacionMsg(
          isPermanentlyDenied(state)
            ? 'Permiso de ubicación bloqueado. Actívalo desde los ajustes del sistema.'
            : 'Sin permiso de ubicación: el partido se creará sin ubicación.',
        );
        return;
      }
      if (!(await hasServicesEnabled())) {
        setGuardarUbicacion(false);
        setUbicacionMsg('El GPS del dispositivo está apagado: el partido se creará sin ubicación.');
        return;
      }
      const data = await getLocationWithAddress();
      setUbicacion(data);
      setGuardarUbicacion(true);
      setUbicacionMsg(`Ubicación lista: ${data.ubicacionTexto}`);
    } catch {
      setGuardarUbicacion(false);
      setUbicacionMsg('No se pudo obtener la ubicación. El partido se creará sin ella.');
    } finally {
      setUbicacionBusy(false);
    }
  };

  const pedirUbicacion = () => {
    Alert.alert(
      'Guardar ubicación de la cancha',
      'Usaremos tu ubicación aproximada solo para registrar dónde se juega este partido. No se usa en segundo plano.',
      [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Permitir', onPress: () => void activarUbicacionAsync() },
      ],
    );
  };

  const quitarUbicacion = () => {
    setGuardarUbicacion(false);
    setUbicacion(null);
    setUbicacionMsg('');
  };

  const getNombreA = () => nombreA.trim() || COLOR_NOMBRES[colorA] || 'Equipo A';
  const getNombreB = () => nombreB.trim() || COLOR_NOMBRES[colorB] || 'Equipo B';

  const handleCrear = async () => {
    const puntos = parseInt(puntosObjetivo, 10);
    if (isNaN(puntos) || puntos < 1 || puntos > 25) {
      setError('Puntos objetivo debe ser entre 1 y 25.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const partido = await api.post<Partido>('/partidos', {
        equipoA: { nombre: getNombreA(), colorHex: colorA },
        equipoB: { nombre: getNombreB(), colorHex: colorB },
        puntosObjetivo: puntos,
        setsParaGanar,
        ...(ubicacion
          ? {
              latitud: ubicacion.latitud,
              longitud: ubicacion.longitud,
              ubicacionTexto: ubicacion.ubicacionTexto,
            }
          : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['partidos'] });
      router.replace(`/partido/${partido.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo crear el partido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={s.backHit}
        >
          <Text style={s.back}>← Volver</Text>
        </Pressable>
        <Text style={s.title} accessibilityRole="header">
          Nuevo partido
        </Text>

        {error ? (
          <View style={s.errorBox} accessibilityRole="alert">
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Equipo A</Text>
          <Text style={s.label}>Nombre (opcional)</Text>
          <TextInput
            style={s.input}
            placeholder={COLOR_NOMBRES[colorA] || 'Equipo A'}
            value={nombreA}
            onChangeText={setNombreA}
            returnKeyType="next"
            maxLength={30}
            accessibilityLabel="Nombre del equipo A"
            accessibilityHint="Opcional, si lo dejas vacío se usa el color"
          />
          <Text style={s.label}>Color</Text>
          <ColorPicker
            selected={colorA}
            onSelect={setColorA}
            disabledColor={colorB}
            label="Equipo A"
          />
          <Text style={s.helper}>Si no escribes un nombre se usará el color seleccionado.</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Equipo B</Text>
          <Text style={s.label}>Nombre (opcional)</Text>
          <TextInput
            style={s.input}
            placeholder={COLOR_NOMBRES[colorB] || 'Equipo B'}
            value={nombreB}
            onChangeText={setNombreB}
            returnKeyType="next"
            maxLength={30}
            accessibilityLabel="Nombre del equipo B"
            accessibilityHint="Opcional, si lo dejas vacío se usa el color"
          />
          <Text style={s.label}>Color</Text>
          <ColorPicker
            selected={colorB}
            onSelect={setColorB}
            disabledColor={colorA}
            label="Equipo B"
          />
          <Text style={s.helper}>No puedes repetir el color del otro equipo.</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Configuración</Text>
          <Text style={s.label}>Puntos por set</Text>
          <TextInput
            style={s.input}
            placeholder="15"
            value={puntosObjetivo}
            onChangeText={setPuntosObjetivo}
            keyboardType="numeric"
            returnKeyType="done"
            maxLength={2}
            accessibilityLabel="Puntos por set"
            accessibilityHint="Entre 1 y 25"
          />

          <Text style={s.label}>Sets para ganar</Text>
          <View style={s.setsRow}>
            {SETS_OPTIONS.map((n) => (
              <Pressable
                key={n}
                style={[s.setOption, setsParaGanar === n && s.setOptionSelected]}
                onPress={() => setSetsParaGanar(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n} ${n === 1 ? 'set único' : `mejor de ${n * 2 - 1}`}`}
                accessibilityState={{ selected: setsParaGanar === n }}
              >
                <Text style={[s.setOptionText, setsParaGanar === n && s.setOptionTextSelected]}>
                  {n}
                </Text>
                <Text style={[s.setOptionSubtext, setsParaGanar === n && s.setOptionTextSelected]}>
                  {n === 1 ? 'set único' : `mejor de ${n * 2 - 1}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Ubicación de la cancha (opcional)</Text>
          <Pressable
            style={s.checkRow}
            onPress={guardarUbicacion ? quitarUbicacion : pedirUbicacion}
            disabled={ubicacionBusy}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: guardarUbicacion, disabled: ubicacionBusy }}
            accessibilityLabel="Guardar ubicación de la cancha"
            accessibilityHint="Solo ubicación aproximada, mientras usas la aplicación"
          >
            <View style={[s.checkBox, guardarUbicacion && s.checkBoxOn]}>
              {guardarUbicacion && <Text style={s.checkMark}>✓</Text>}
            </View>
            <Text style={s.checkLabel}>Guardar ubicación de la cancha</Text>
            {ubicacionBusy && <ActivityIndicator size="small" color={colors.primary} />}
          </Pressable>
          <Text style={s.helper}>
            Solo ubicación aproximada y en primer plano; nunca en segundo plano.
          </Text>
          {ubicacionMsg ? (
            <Text style={s.helper} accessibilityRole="alert">
              {ubicacionMsg}
            </Text>
          ) : null}
          {ubicacionPermiso && isPermanentlyDenied(ubicacionPermiso) ? (
            <Pressable
              style={s.settingsBtn}
              onPress={openLocationSettings}
              accessibilityRole="button"
              accessibilityLabel="Abrir ajustes del sistema para activar la ubicación"
            >
              <Text style={s.settingsBtnText}>Abrir ajustes</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          style={[s.btn, loading && s.btnDisabled]}
          onPress={handleCrear}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Crear partido"
          accessibilityState={{ disabled: loading, busy: loading }}
        >
          {loading ? (
            <ActivityIndicator color="white" accessibilityLabel="Creando partido" />
          ) : (
            <Text style={s.btnText}>Crear partido</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  backHit: { marginBottom: 8, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  back: { color: colors.primary, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.ink, marginBottom: 24 },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    borderRadius: radius.sm,
    ...curve,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#991B1B', fontSize: 13 },
  section: {
    backgroundColor: 'white',
    borderRadius: radius.md,
    ...curve,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.ink, marginBottom: 12 },
  label: { color: colors.ink, fontWeight: '600', marginBottom: 4 },
  helper: { color: colors.muted, fontSize: 12, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: radius.md,
    ...curve,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: 'white',
    fontSize: 16,
    minHeight: 48,
  },
  colorRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  colorDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  colorSelected: { borderWidth: 4, borderColor: colors.ink },
  colorDisabled: { opacity: 0.25 },
  setsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingVertical: 4,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  checkBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  checkLabel: { color: colors.ink, fontWeight: '500', flex: 1 },
  settingsBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    ...curve,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  settingsBtnText: { color: colors.primary, fontWeight: '600' },
  setOption: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: radius.md,
    ...curve,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 64,
    justifyContent: 'center',
  },
  setOptionSelected: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  setOptionText: { fontSize: 20, fontWeight: 'bold', color: colors.muted },
  setOptionTextSelected: { color: colors.primary },
  setOptionSubtext: { fontSize: 11, color: colors.faint, marginTop: 2 },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    ...curve,
    marginTop: 8,
    minHeight: 54,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' },
});
