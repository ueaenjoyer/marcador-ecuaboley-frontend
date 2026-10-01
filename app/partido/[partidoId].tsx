import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
  Animated,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api, ApiError, isForbidden, permisoMensaje } from '../../lib/api';
import { colors, radius, curve, spacing, touch, type } from '../../lib/theme';
import type { Partido, RegistrarJugadaResponse } from '../../lib/types';

export default function PartidoMarcador() {
  const { partidoId } = useLocalSearchParams<{ partidoId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [showFinBanner, setShowFinBanner] = useState(false);
  const [finOpacity] = useState(new Animated.Value(0));

  const { data: partido, isLoading } = useQuery({
    queryKey: ['partido', partidoId],
    queryFn: () => api.get<Partido>(`/partidos/${partidoId}`),
  });

  // Manejo unificado de errores de acción del juez.
  // - 403 (sin permiso): Alert con mensaje de permisos y NO se toca el marcador
  //   (queryClient intacto) — Req 4.2, 4.3, 5.4.
  // - 401 por sesión expirada: la renovación fallida ya emitió la señal de
  //   expiración y la navegación reemplaza la pantalla; aquí no se aplica ningún
  //   cambio al marcador — Req 5.5.
  // - Otros ApiError: alerta genérica con el mensaje del error.
  const handleActionError = useCallback((err: unknown) => {
    if (isForbidden(err)) {
      Alert.alert('Sin permiso', permisoMensaje(err as ApiError));
      return;
    }
    if (err instanceof ApiError) Alert.alert('Error', err.message);
  }, []);

  // Animate finalization banner
  useEffect(() => {
    if (partido?.estado === 'FINALIZADO' && !showFinBanner) {
      setShowFinBanner(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.timing(finOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [partido?.estado, showFinBanner, finOpacity]);

  const registrarCambio = useCallback(async () => {
    if (actionLoading || !partido) return;
    const setActivo = partido.sets.find((s) => !s.finalizado);
    if (!setActivo) return;
    // CAMBIO = equipo que NO tiene batida gana la jugada
    const equipoSinBatida = partido.equipos.find((e) => e.id !== setActivo.equipoConBatida?.id);
    if (!equipoSinBatida) return;

    setActionLoading(true);
    setLastAction(null);
    try {
      const res = await api.post<RegistrarJugadaResponse>(`/partidos/${partidoId}/punto`, {
        equipoGanadorJugadaId: equipoSinBatida.id,
      });
      setLastAction(res.tipo);
      queryClient.setQueryData(['partido', partidoId], res.partido);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      handleActionError(err);
    } finally {
      setActionLoading(false);
    }
  }, [partidoId, partido, actionLoading, queryClient, handleActionError]);

  const registrarPunto = useCallback(async () => {
    if (actionLoading || !partido) return;
    const setActivo = partido.sets.find((s) => !s.finalizado);
    if (!setActivo) return;
    // PUNTO = equipo con batida gana la jugada
    const equipoConBatida = partido.equipos.find((e) => e.id === setActivo.equipoConBatida?.id);
    if (!equipoConBatida) return;

    setActionLoading(true);
    setLastAction(null);
    try {
      const res = await api.post<RegistrarJugadaResponse>(`/partidos/${partidoId}/punto`, {
        equipoGanadorJugadaId: equipoConBatida.id,
      });
      setLastAction(res.tipo);
      queryClient.setQueryData(['partido', partidoId], res.partido);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      handleActionError(err);
    } finally {
      setActionLoading(false);
    }
  }, [partidoId, partido, actionLoading, queryClient, handleActionError]);

  const ejecutarUndo = useCallback(async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setLastAction(null);
    try {
      const p = await api.post<Partido>(`/partidos/${partidoId}/undo`);
      setLastAction('UNDO');
      queryClient.setQueryData(['partido', partidoId], p);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      handleActionError(err);
    } finally {
      setActionLoading(false);
    }
  }, [partidoId, actionLoading, queryClient, handleActionError]);

  const hacerUndo = useCallback(() => {
    if (actionLoading) return;
    Alert.alert('Deshacer última acción', '¿Seguro que quieres revertir la última jugada?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Deshacer', style: 'destructive', onPress: () => void ejecutarUndo() },
    ]);
  }, [actionLoading, ejecutarUndo]);

  const iniciarSiguienteSet = useCallback(async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setLastAction(null);
    try {
      const p = await api.post<Partido>(`/partidos/${partidoId}/siguiente-set`);
      queryClient.setQueryData(['partido', partidoId], p);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      handleActionError(err);
    } finally {
      setActionLoading(false);
    }
  }, [partidoId, actionLoading, queryClient, handleActionError]);

  const togglePausa = useCallback(async () => {
    if (actionLoading || !partido) return;
    setActionLoading(true);
    const nuevoEstado = partido.estado === 'PAUSADO' ? 'ACTIVO' : 'PAUSADO';
    try {
      const p = await api.patch<Partido>(`/partidos/${partidoId}`, { estado: nuevoEstado });
      queryClient.setQueryData(['partido', partidoId], p);
    } catch (err) {
      handleActionError(err);
    } finally {
      setActionLoading(false);
    }
  }, [partidoId, partido, actionLoading, queryClient, handleActionError]);

  const compartir = useCallback(async () => {
    if (!partido) return;
    try {
      await Share.share({ message: `Mira el partido en vivo! Codigo: ${partido.codigoSala}` });
    } catch {}
  }, [partido]);

  if (isLoading || !partido) {
    return (
      <SafeAreaView style={st.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </SafeAreaView>
    );
  }

  const equipoA = partido.equipos[0];
  const equipoB = partido.equipos[1];
  const setActivo = partido.sets.find((s) => !s.finalizado);
  const ultimoSet = partido.sets[partido.sets.length - 1];
  const setActual = setActivo ?? ultimoSet;
  const esFinalizado = partido.estado === 'FINALIZADO';
  const esPausado = partido.estado === 'PAUSADO';
  const batidaId = setActual?.equipoConBatida?.id;
  const equipoConBatida = partido.equipos.find((e) => e.id === batidaId);

  // Calcular sets ganados
  const setsGanadosA = partido.sets.filter(
    (s) => s.finalizado && s.equipoGanador?.id === equipoA?.id,
  ).length;
  const setsGanadosB = partido.sets.filter(
    (s) => s.finalizado && s.equipoGanador?.id === equipoB?.id,
  ).length;

  // Estado entre sets
  const entresets = partido.estado === 'ACTIVO' && !setActivo && ultimoSet?.finalizado;

  // Determine match winner for finalization banner
  const ganadorPartido =
    esFinalizado && ultimoSet?.equipoGanador ? ultimoSet.equipoGanador.nombre : null;

  const colorA = equipoA?.colorHex ?? '#FF6B00';
  const colorB = equipoB?.colorHex ?? '#1E40AF';

  return (
    <SafeAreaView style={st.container}>
      <View style={st.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al dashboard"
          style={st.headerBtnHit}
        >
          <Text style={st.headerBtn}>← Volver</Text>
        </Pressable>
        {partido.setsParaGanar > 1 ? (
          <View style={st.setsChip}>
            <Text style={st.setsChipLabel}>Sets</Text>
            <Text style={[st.setsChipScore, { color: colorA }]}>{setsGanadosA}</Text>
            <Text style={st.setsChipSep}>-</Text>
            <Text style={[st.setsChipScore, { color: colorB }]}>{setsGanadosB}</Text>
          </View>
        ) : (
          <View />
        )}
        {esFinalizado || entresets ? (
          <View style={st.headerSpacer} />
        ) : (
          <Pressable
            style={[st.pauseToggle, esPausado && st.pauseToggleActive]}
            onPress={togglePausa}
            accessibilityRole="button"
            accessibilityLabel={esPausado ? 'Reanudar partido' : 'Pausar partido'}
          >
            <Text style={st.pauseToggleText}>{esPausado ? '▶ Seguir' : '⏸ Pausa'}</Text>
          </Pressable>
        )}
      </View>

      {/* Finalization banner with animation */}
      {esFinalizado && (
        <Animated.View style={[st.finBanner, { opacity: finOpacity }]}>
          <Text style={st.finBannerTitle}>PARTIDO FINALIZADO</Text>
          {ganadorPartido && <Text style={st.finBannerGanador}>Ganador: {ganadorPartido}</Text>}
        </Animated.View>
      )}

      {esPausado && (
        <View
          style={[st.banner, { backgroundColor: '#92400E' }]}
          accessibilityRole="alert"
        >
          <Text style={st.bannerText}>Partido en pausa</Text>
          <Text style={st.bannerSubtext}>
            Las acciones están bloqueadas hasta reanudar el partido.
          </Text>
        </View>
      )}

      {partido.estado === 'ACTIVO' && !entresets && !esFinalizado && (
        <View style={st.salaCard}>
          <View style={st.salaInfo}>
            <Text style={st.salaLabel}>Sala de espectadores</Text>
            <Text style={st.salaCode} accessibilityLabel={`Código de sala ${partido.codigoSala}`}>
              {partido.codigoSala}
            </Text>
          </View>
          <Pressable
            style={st.salaBtn}
            onPress={compartir}
            accessibilityRole="button"
            accessibilityLabel="Compartir código de sala"
          >
            <Text style={st.salaBtnText}>Compartir ↗</Text>
          </Pressable>
        </View>
      )}

      {entresets && (
        <View style={st.entresetsBanner}>
          <Text style={st.entresetsTitulo}>Set {ultimoSet.numero} finalizado</Text>
          <Text style={st.entresetsGanador}>Ganador: {ultimoSet.equipoGanador?.nombre}</Text>
          <Pressable style={st.entresetsBtn} onPress={iniciarSiguienteSet} disabled={actionLoading}>
            <Text style={st.entresetsBtnText}>Iniciar Set {ultimoSet.numero + 1}</Text>
          </Pressable>
        </View>
      )}

      {lastAction && !entresets && !esFinalizado ? (
        <View style={st.feedbackPill}>
          <Text
            style={[
              st.feedbackText,
              {
                color:
                  lastAction === 'PUNTO'
                    ? '#4ADE80'
                    : lastAction === 'CAMBIO'
                      ? '#FB923C'
                      : '#FBBF24',
              },
            ]}
          >
            {lastAction === 'PUNTO'
              ? 'Punto registrado'
              : lastAction === 'CAMBIO'
                ? 'Cambio de batida'
                : 'Acción deshecha'}
          </Text>
        </View>
      ) : null}

      {/* Scoreboard: la pieza memorable — números gigantes con banda del color
          de cada equipo; todo lo demás queda quieto y oscuro. */}
      <View style={st.marcador}>
        <View style={st.lado}>
          <View style={[st.banda, { backgroundColor: colorA }]} />
          <Text style={st.equipoNombre} numberOfLines={1}>
            {equipoA?.nombre ?? 'A'}
          </Text>
          <Text style={st.puntaje}>{setActual?.puntosEquipoA ?? 0}</Text>
          {batidaId === equipoA?.id ? (
            <View
              style={[st.batidaBadge, { backgroundColor: colorA }]}
              accessibilityRole="alert"
            >
              <Text style={st.batidaText}>● Con la batida</Text>
            </View>
          ) : (
            <Text style={st.sinBatidaText}>Sin batida</Text>
          )}
        </View>
        <View style={st.separador}>
          {setActual ? (
            <View style={st.setChip}>
              <Text style={st.setChipText}>Set {setActual.numero}</Text>
            </View>
          ) : null}
        </View>
        <View style={st.lado}>
          <View style={[st.banda, { backgroundColor: colorB }]} />
          <Text style={st.equipoNombre} numberOfLines={1}>
            {equipoB?.nombre ?? 'B'}
          </Text>
          <Text style={st.puntaje}>{setActual?.puntosEquipoB ?? 0}</Text>
          {batidaId === equipoB?.id ? (
            <View
              style={[st.batidaBadge, { backgroundColor: colorB }]}
              accessibilityRole="alert"
            >
              <Text style={st.batidaText}>● Con la batida</Text>
            </View>
          ) : (
            <Text style={st.sinBatidaText}>Sin batida</Text>
          )}
        </View>
      </View>

      {/* Action buttons — PUNTO dominante + CAMBIO secundario + undo con confirmación */}
      {!esFinalizado && !entresets && (
        <View style={st.actions}>
          <View style={st.btnRow}>
            <Pressable
              style={[st.cambioBtn, (actionLoading || esPausado) && st.disabled]}
              onPress={registrarCambio}
              disabled={actionLoading || esPausado}
              accessibilityRole="button"
              accessibilityLabel="Registrar cambio de batida"
              accessibilityState={{ disabled: actionLoading || esPausado, busy: actionLoading }}
            >
              <Text style={st.cambioBtnText}>CAMBIO</Text>
              <Text style={st.cambioBtnSub}>Rota la batida</Text>
            </Pressable>
            <Pressable
              style={[
                st.puntoBtn,
                { backgroundColor: equipoConBatida?.colorHex ?? '#16A34A' },
                (actionLoading || esPausado) && st.disabled,
              ]}
              onPress={registrarPunto}
              disabled={actionLoading || esPausado}
              accessibilityRole="button"
              accessibilityLabel={`Registrar punto para ${equipoConBatida?.nombre ?? 'equipo con batida'}`}
              accessibilityState={{ disabled: actionLoading || esPausado, busy: actionLoading }}
            >
              <Text style={st.puntoBtnText}>PUNTO</Text>
              <Text style={st.puntoBtnSub}>
                {actionLoading ? 'Registrando…' : (equipoConBatida?.nombre ?? '?')}
              </Text>
            </Pressable>
          </View>
          <Pressable
            style={[st.undoBtn, (actionLoading || esPausado) && st.disabled]}
            onPress={hacerUndo}
            disabled={actionLoading || esPausado}
            accessibilityRole="button"
            accessibilityLabel="Deshacer última acción"
          >
            <Text style={st.undoBtnText}>↩ Deshacer última acción</Text>
          </Pressable>
          {actionLoading ? <Text style={st.processingText}>Registrando jugada…</Text> : null}
        </View>
      )}

      {actionLoading && (
        <View style={st.overlay}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.board,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { flex: 1, backgroundColor: colors.board },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  headerBtn: { color: colors.onBoard, fontWeight: '500' },
  headerBtnHit: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    minHeight: touch.minHeight,
    justifyContent: 'center',
  },
  headerSpacer: { width: 96 },
  setsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.boardPanel,
    borderWidth: 1,
    borderColor: colors.boardLine,
    borderRadius: radius.md,
    ...curve,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  setsChipLabel: { color: colors.onBoardMuted, fontSize: 12 },
  setsChipScore: { fontSize: 18, fontWeight: 'bold' },
  setsChipSep: { color: colors.onBoardFaint, fontSize: 16, fontWeight: 'bold' },
  pauseToggle: {
    backgroundColor: colors.boardPanel,
    borderWidth: 1,
    borderColor: colors.boardLine,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    ...curve,
    minHeight: touch.minHeight,
    justifyContent: 'center',
  },
  pauseToggleActive: { backgroundColor: colors.success },
  pauseToggleText: { color: colors.onBoard, fontSize: 13, fontWeight: '600' },
  finBanner: {
    backgroundColor: '#065F46',
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    ...curve,
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  finBannerTitle: { color: colors.onBoard, ...type.title },
  finBannerGanador: { color: '#FDE68A', fontSize: 16, fontWeight: '600', marginTop: spacing.xs },
  banner: {
    backgroundColor: colors.boardPanel,
    borderWidth: 1,
    borderColor: colors.boardLine,
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    ...curve,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  bannerText: { color: colors.onBoard, textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  bannerSubtext: { color: colors.onBoardMuted, textAlign: 'center', fontSize: 12, marginTop: 4 },
  salaCard: {
    backgroundColor: colors.boardPanel,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    ...curve,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.boardLine,
  },
  salaInfo: { flex: 1, gap: 2 },
  salaLabel: { color: colors.onBoardFaint, fontSize: 11 },
  salaCode: { color: colors.onBoard, fontSize: 22, fontWeight: 'bold', letterSpacing: 3 },
  salaBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.md,
    ...curve,
    minHeight: touch.minHeight,
    justifyContent: 'center',
  },
  salaBtnText: { color: colors.onBoard, fontWeight: '600', fontSize: 13 },
  entresetsBanner: {
    backgroundColor: '#1E3A5F',
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    ...curve,
    padding: spacing.xl,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  entresetsTitulo: { color: colors.onBoard, ...type.section, marginBottom: spacing.xs },
  entresetsGanador: { color: colors.gold, fontSize: 15, marginBottom: spacing.lg },
  entresetsBtn: {
    backgroundColor: colors.success,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.md,
    ...curve,
    minHeight: touch.minHeight,
    justifyContent: 'center',
  },
  entresetsBtnText: { color: colors.onBoard, fontSize: 16, fontWeight: 'bold' },
  feedbackPill: {
    alignSelf: 'center',
    backgroundColor: colors.boardPanel,
    borderWidth: 1,
    borderColor: colors.boardLine,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  feedbackText: { textAlign: 'center', fontSize: 13, fontWeight: '600' },
  marcador: { flex: 1, flexDirection: 'row', gap: 2 },
  lado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.boardPanel,
    borderRadius: radius.lg,
    ...curve,
    marginHorizontal: spacing.sm,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  banda: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  separador: { width: 64, justifyContent: 'center', alignItems: 'center' },
  setChip: {
    backgroundColor: colors.boardPanel,
    borderWidth: 1,
    borderColor: colors.boardLine,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  setChipText: { color: colors.onBoardMuted, fontSize: 12, fontWeight: '600' },
  equipoNombre: { color: colors.onBoardMuted, fontSize: 15, fontWeight: '600' },
  puntaje: { color: colors.onBoard, ...type.hero },
  batidaBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  batidaText: { color: colors.onBoard, fontSize: 12, fontWeight: '700' },
  sinBatidaText: { color: colors.onBoardFaint, fontSize: 12 },
  actions: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm },
  btnRow: { flexDirection: 'row', gap: spacing.md, marginBottom: 10 },
  cambioBtn: {
    flex: 1,
    backgroundColor: colors.boardPanel,
    borderWidth: 1,
    borderColor: colors.boardLine,
    paddingVertical: 18,
    borderRadius: radius.lg,
    ...curve,
    alignItems: 'center',
    minHeight: 68,
    justifyContent: 'center',
  },
  cambioBtnText: { color: colors.onBoard, fontSize: 16, fontWeight: 'bold' },
  cambioBtnSub: { color: colors.onBoardMuted, fontSize: 11, marginTop: 2 },
  puntoBtn: {
    flex: 1.6,
    paddingVertical: 18,
    borderRadius: radius.lg,
    ...curve,
    alignItems: 'center',
    minHeight: 68,
    justifyContent: 'center',
  },
  puntoBtnText: { color: colors.onBoard, fontSize: 19, fontWeight: 'bold' },
  puntoBtnSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  processingText: { color: colors.gold, textAlign: 'center', fontSize: 12, marginTop: spacing.sm },
  undoBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    ...curve,
    borderWidth: 1,
    borderColor: colors.boardLine,
    minHeight: touch.minHeight,
    justifyContent: 'center',
  },
  undoBtnText: { color: colors.gold, textAlign: 'center', fontSize: 13, fontWeight: '500' },
  disabled: { opacity: 0.4 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
