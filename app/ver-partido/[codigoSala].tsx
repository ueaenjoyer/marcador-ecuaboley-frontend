import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSocket, disconnectSocket } from '../../lib/socket';
import { colors, radius, curve } from '../../lib/theme';
import {
  getPermissionState,
  requestPermission,
  subscribeToPartido,
  unsubscribeFromPartido,
  openSettings,
} from '../../lib/native/notifications';
import { getAvisosPreference } from '../../lib/native/preferences';
import { isGranted, isPermanentlyDenied } from '../../lib/native/permission-types';
import type { PermissionState } from '../../lib/native/permission-types';
import type { Partido } from '../../lib/types';

export default function VerPartido() {
  const { codigoSala } = useLocalSearchParams<{ codigoSala: string }>();
  const router = useRouter();
  const [partido, setPartido] = useState<Partido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [showFinBanner, setShowFinBanner] = useState(false);
  const finOpacity = useRef(new Animated.Value(0)).current;

  const [permisoAvisos, setPermisoAvisos] = useState<PermissionState | null>(null);
  const [avisosBusy, setAvisosBusy] = useState(false);
  const [avisosMsg, setAvisosMsg] = useState<string | null>(null);

  const [estadoConexion, setEstadoConexion] = useState<'conectando' | 'en-vivo' | 'reconectando'>(
    'conectando',
  );

  const conectar = useCallback(() => {
    const socket = getSocket();
    socket.removeAllListeners();
    socket.on('connect', () => {
      socket.emit('unirse:sala', { codigoSala });
    });
    socket.on('partido:estado', (data: Partido) => {
      setPartido(data);
      setConnecting(false);
      setEstadoConexion('en-vivo');
      setError(null);
    });
    socket.on('marcador:actualizado', (data: Partido) => {
      setPartido(data);
      setEstadoConexion('en-vivo');
      setError(null);
    });
    socket.on('error', (err: { message: string }) => {
      setError(err.message);
      setConnecting(false);
    });
    socket.on('disconnect', () => {
      // Se conserva el último marcador en pantalla y se marca reconexión.
      setEstadoConexion((prev) => (prev === 'en-vivo' ? 'reconectando' : prev));
      setError((prev) => prev ?? 'Conexión perdida. Reintentando…');
    });
    socket.connect();
    return () => {
      socket.removeAllListeners();
      disconnectSocket();
    };
  }, [codigoSala]);

  useEffect(() => {
    const cleanup = conectar();
    return cleanup;
  }, [conectar]);

  const reintentar = useCallback(() => {
    setError(null);
    setConnecting((prev) => (partido ? prev : true));
    setEstadoConexion(partido ? 'reconectando' : 'conectando');
    disconnectSocket();
    conectar();
  }, [conectar, partido]);

  // ─── Avisos push (Semana 14) ─────────────────────────────────────────────
  // El permiso se pide solo al pulsar el botón, con explicación previa.
  // Si falla cualquier paso, la sala sigue funcionando por Socket.io.

  useEffect(() => {
    let activo = true;
    const init = async () => {
      try {
        const state = await getPermissionState();
        if (!activo) return;
        setPermisoAvisos(state);
        // Preferencia guardada localmente: re-suscripción silenciosa.
        if (isGranted(state) && (await getAvisosPreference(codigoSala))) {
          await subscribeToPartido(codigoSala);
        }
      } catch {
        // Sin permisos consultables o sin projectId: la sala sigue normal.
      }
    };
    void init();
    return () => {
      activo = false;
    };
  }, [codigoSala]);

  const desactivarAvisos = useCallback(async () => {
    try {
      await unsubscribeFromPartido(codigoSala);
      setAvisosMsg('Avisos desactivados.');
    } catch {
      setAvisosMsg('No se pudieron desactivar los avisos.');
    }
  }, [codigoSala]);

  const activarAvisosAsync = useCallback(async () => {
    setAvisosBusy(true);
    setAvisosMsg(null);
    try {
      let state = await getPermissionState();
      if (!isGranted(state)) {
        state = await requestPermission();
      }
      setPermisoAvisos(state);
      if (!isGranted(state)) {
        setAvisosMsg(
          isPermanentlyDenied(state)
            ? 'Notificaciones bloqueadas. Actívalas desde los ajustes del sistema.'
            : 'Sin permiso de notificaciones por ahora. Puedes reintentar cuando quieras.',
        );
        return;
      }
      await subscribeToPartido(codigoSala);
      setAvisosMsg('Avisos activados: te avisaremos solo cuando termine cada set.');
    } catch {
      setAvisosMsg('No se pudieron activar los avisos. La sala sigue en vivo.');
    } finally {
      setAvisosBusy(false);
    }
  }, [codigoSala]);

  const pedirAvisos = useCallback(() => {
    Alert.alert(
      'Recibir avisos de sets',
      'Te enviaremos una notificación solo cuando termine un set o el partido, aunque salgas de la app. No avisamos de cada punto.',
      [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Activar', onPress: () => void activarAvisosAsync() },
      ],
    );
  }, [activarAvisosAsync]);

  // Animate finalization banner when partido becomes FINALIZADO
  const esFinalizado = partido?.estado === 'FINALIZADO';
  useEffect(() => {
    if (esFinalizado && !showFinBanner) {
      setShowFinBanner(true);
      Animated.timing(finOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [esFinalizado, showFinBanner, finOpacity]);

  const handleSalir = useCallback(() => {
    disconnectSocket();
    router.back();
  }, [router]);

  // Al desmontar la sala (Salir, atrás del sistema o navegación) se desactiva
  // la suscripción de avisos. Es el único punto de baja: evita duplicar el POST.
  useEffect(() => {
    return () => {
      void desactivarAvisos();
    };
  }, [desactivarAvisos]);

  if (error && !partido) {
    return (
      <SafeAreaView style={st.errorContainer}>
        <Text style={st.errorTitle}>No se pudo conectar</Text>
        <Text style={st.errorMsg}>{error}</Text>
        <Text style={st.errorHint}>Verifica el código de sala y tu conexión a internet.</Text>
        <View style={st.errorActions}>
          <Pressable
            style={st.errorBtn}
            onPress={reintentar}
            accessibilityRole="button"
            accessibilityLabel="Reintentar conexión"
          >
            <Text style={st.errorBtnText}>Reintentar</Text>
          </Pressable>
          <Pressable
            style={st.errorSecondaryBtn}
            onPress={handleSalir}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Text style={st.errorSecondaryBtnText}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (connecting || !partido) {
    return (
      <SafeAreaView style={st.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" accessibilityLabel="Conectando a la sala" />
        <Text style={st.loadingText}>Conectando a sala {codigoSala}...</Text>
        <Pressable
          style={st.retryGhostBtn}
          onPress={reintentar}
          accessibilityRole="button"
          accessibilityLabel="Reintentar conexión"
        >
          <Text style={st.retryGhostBtnText}>Reintentar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const equipoA = partido.equipos[0];
  const equipoB = partido.equipos[1];
  const setActivo = partido.sets.find((s) => !s.finalizado);
  const ultimoSet = partido.sets[partido.sets.length - 1];
  const setActual = setActivo ?? ultimoSet;
  const batidaId = setActual?.equipoConBatida?.id;

  // Calcular sets ganados por cada equipo
  const setsGanadosA = partido.sets.filter(
    (s) => s.finalizado && s.equipoGanador?.id === equipoA?.id,
  ).length;
  const setsGanadosB = partido.sets.filter(
    (s) => s.finalizado && s.equipoGanador?.id === equipoB?.id,
  ).length;

  // Detectar estado intermedio: set finalizado pero partido ACTIVO y sin set activo
  const entresets = partido.estado === 'ACTIVO' && !setActivo && ultimoSet?.finalizado;

  const enVivo = estadoConexion === 'en-vivo' && !esFinalizado;

  const avisosEstado: PermissionState = permisoAvisos ?? {
    status: 'undetermined',
    canAskAgain: true,
  };

  return (
    <SafeAreaView style={st.container}>
      <View style={st.header}>
        <Pressable
          onPress={handleSalir}
          accessibilityRole="button"
          accessibilityLabel="Salir de la sala"
          style={st.headerHit}
        >
          <Text style={st.headerBtn}>← Salir</Text>
        </Pressable>
        <Text style={st.liveText}>
          {esFinalizado ? `FINALIZADO - ${codigoSala}` : `${enVivo ? 'EN VIVO' : estadoConexion === 'reconectando' ? 'RECONECTANDO' : 'CONECTANDO'} - ${codigoSala}`}
        </Text>
        <View style={[st.liveDot, !enVivo && st.liveDotOff]} />
      </View>

      {(error || estadoConexion === 'reconectando') && (
        <View style={st.warnBanner} accessibilityRole="alert">
          <Text style={st.warnText}>{error ?? 'Conexión perdida. Mostrando el último marcador…'}</Text>
          <Pressable
            onPress={reintentar}
            accessibilityRole="button"
            accessibilityLabel="Reintentar conexión"
            style={st.warnRetryHit}
          >
            <Text style={st.warnRetryText}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      {/* Marcador de sets */}
      {partido.setsParaGanar > 1 && (
        <View style={st.setsRow}>
          <Text style={st.setsLabel}>Sets:</Text>
          <Text style={[st.setsScore, { color: equipoA?.colorHex ?? colors.spectator }]}>
            {setsGanadosA}
          </Text>
          <Text style={st.setsSeparator}>-</Text>
          <Text style={[st.setsScore, { color: equipoB?.colorHex ?? '#1E40AF' }]}>
            {setsGanadosB}
          </Text>
        </View>
      )}

      {esFinalizado && (
        <Animated.View style={[st.finBanner, { opacity: finOpacity }]}>
          <Text style={st.finBannerTitle}>PARTIDO FINALIZADO</Text>
          {ultimoSet?.equipoGanador && (
            <Text style={st.finBannerGanador}>Ganador: {ultimoSet.equipoGanador.nombre}</Text>
          )}
        </Animated.View>
      )}

      {entresets && (
        <View style={st.entresetsBanner}>
          <Text style={st.entresetsTitulo}>Set {ultimoSet.numero} finalizado</Text>
          <Text style={st.entresetsGanador}>Ganador: {ultimoSet.equipoGanador?.nombre}</Text>
          <Text style={st.entresetsWait}>Esperando que el juez inicie el siguiente set...</Text>
        </View>
      )}

      <View style={st.marcador}>
        <View style={[st.lado, { backgroundColor: (equipoA?.colorHex ?? colors.spectator) + '20' }]}>
          <Text style={st.equipoNombre}>{equipoA?.nombre ?? 'A'}</Text>
          <Text style={st.puntaje}>{setActual?.puntosEquipoA ?? 0}</Text>
          {batidaId === equipoA?.id && (
            <View style={st.batidaBadge}>
              <Text style={st.batidaText}>BATIDA</Text>
            </View>
          )}
        </View>
        <View style={st.separador}>
          {setActual && <Text style={st.setNumero}>Set {setActual.numero}</Text>}
        </View>
        <View style={[st.lado, { backgroundColor: (equipoB?.colorHex ?? '#1E40AF') + '20' }]}>
          <Text style={st.equipoNombre}>{equipoB?.nombre ?? 'B'}</Text>
          <Text style={st.puntaje}>{setActual?.puntosEquipoB ?? 0}</Text>
          {batidaId === equipoB?.id && (
            <View style={st.batidaBadge}>
              <Text style={st.batidaText}>BATIDA</Text>
            </View>
          )}
        </View>
      </View>

      {!esFinalizado && (
        <View style={st.avisosBox}>
          {isPermanentlyDenied(avisosEstado) ? (
            <Pressable
              style={st.avisosBtn}
              onPress={openSettings}
              accessibilityRole="button"
              accessibilityLabel="Abrir ajustes del sistema para activar notificaciones"
            >
              <Text style={st.avisosBtnText}>Abrir ajustes</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[st.avisosBtn, avisosBusy && st.avisosBtnDisabled]}
              onPress={isGranted(avisosEstado) ? () => void desactivarAvisos() : pedirAvisos}
              disabled={avisosBusy}
              accessibilityRole="button"
              accessibilityLabel={
                isGranted(avisosEstado) ? 'Desactivar avisos de sets' : 'Recibir avisos de sets'
              }
              accessibilityState={{ disabled: avisosBusy, busy: avisosBusy }}
            >
              {avisosBusy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={st.avisosBtnText}>
                  {isGranted(avisosEstado) ? 'Desactivar avisos de sets' : 'Recibir avisos de sets'}
                </Text>
              )}
            </Pressable>
          )}
          {avisosMsg && <Text style={st.avisosMsg}>{avisosMsg}</Text>}
        </View>
      )}

      <View style={st.footer}>
        <Text style={st.footerText}>Modo espectador - se actualiza automaticamente</Text>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: { fontSize: 24, fontWeight: 'bold', color: colors.danger, marginBottom: 8 },
  errorMsg: { color: colors.ink, textAlign: 'center', marginBottom: 8 },
  errorHint: { color: colors.muted, textAlign: 'center', fontSize: 13, marginBottom: 24 },
  errorActions: { flexDirection: 'row', gap: 12 },
  errorBtn: {
    backgroundColor: colors.spectator,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: radius.md,
      ...curve,
    minHeight: 48,
    justifyContent: 'center',
  },
  errorBtnText: { color: 'white', fontWeight: '600' },
  errorSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.md,
      ...curve,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'white',
    minHeight: 48,
    justifyContent: 'center',
  },
  errorSecondaryBtnText: { color: colors.muted, fontWeight: '600' },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.board,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: { color: 'white', marginTop: 16, marginBottom: 16 },
  retryGhostBtn: {
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: radius.md,
      ...curve,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  retryGhostBtnText: { color: 'white', fontWeight: '600' },
  container: { flex: 1, backgroundColor: colors.board },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerHit: { paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  headerBtn: { color: 'white', fontWeight: '500' },
  liveText: { color: '#E5E7EB', fontSize: 12, fontWeight: '600' },
  liveDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ADE80' },
  liveDotOff: { backgroundColor: '#FBBF24' },
  warnBanner: {
    backgroundColor: '#92400E',
    marginHorizontal: 16,
    borderRadius: radius.sm,
      ...curve,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  warnText: { color: 'white', fontSize: 12, flex: 1 },
  warnRetryHit: { paddingVertical: 8, paddingHorizontal: 8, minHeight: 44, justifyContent: 'center' },
  warnRetryText: { color: '#FDE68A', fontWeight: '700', fontSize: 12 },
  setsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  setsLabel: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },
  setsScore: { fontSize: 20, fontWeight: 'bold' },
  setsSeparator: { color: '#9CA3AF', fontSize: 20, fontWeight: 'bold' },
  banner: {
    backgroundColor: '#374151',
    marginHorizontal: 16,
    borderRadius: radius.sm,
      ...curve,
    paddingVertical: 10,
    marginBottom: 8,
  },
  bannerText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  ganadorText: { color: '#FBBF24', textAlign: 'center', marginTop: 4 },
  finBanner: {
    backgroundColor: '#065F46',
    marginHorizontal: 16,
    borderRadius: radius.md,
      ...curve,
    paddingVertical: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  finBannerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  finBannerGanador: { color: '#FDE68A', fontSize: 16, fontWeight: '600', marginTop: 4 },
  entresetsBanner: {
    backgroundColor: '#1E3A5F',
    marginHorizontal: 16,
    borderRadius: radius.md,
      ...curve,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  entresetsTitulo: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  entresetsGanador: { color: '#FBBF24', fontSize: 14, marginBottom: 8 },
  entresetsWait: { color: '#9CA3AF', fontSize: 13 },
  marcador: { flex: 1, flexDirection: 'row' },
  lado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  separador: {
    width: 2,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  setNumero: {
    color: '#6B7280',
    fontSize: 10,
    position: 'absolute',
    backgroundColor: colors.board,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  equipoNombre: { color: 'white', fontSize: 14, opacity: 0.85, marginBottom: 4 },
  puntaje: { color: 'white', fontSize: 72, fontWeight: 'bold' },
  batidaBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.md,
      ...curve,
  },
  batidaText: { color: 'white', fontSize: 11, fontWeight: '700' },
  avisosBox: { paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  avisosBtn: {
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: radius.md,
    ...curve,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  avisosBtnDisabled: { opacity: 0.6 },
  avisosBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  avisosMsg: { color: '#D1D5DB', fontSize: 12, textAlign: 'center' },
  footer: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#374151' },
  footerText: { color: colors.line, textAlign: 'center', fontSize: 13 },
});
