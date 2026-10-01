import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { memo, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../lib/auth-store';
import { api, ApiError } from '../lib/api';
import { colors, radius, curve, spacing, touch } from '../lib/theme';
import type { Partido } from '../lib/types';

const dateFormatter = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' });

const formatFecha = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return dateFormatter.format(parsed);
};

interface PartidoCardProps {
  id: string;
  codigoSala: string;
  estado: Partido['estado'];
  nombreA: string;
  colorA: string;
  nombreB: string;
  colorB: string;
  fecha: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

// Tarjeta liviana: solo primitivas para que memo() funcione y los callbacks
// viven en la raíz de la lista (reglas list-performance de RN skills).
const PartidoCard = memo(function PartidoCard({
  id,
  codigoSala,
  estado,
  nombreA,
  colorA,
  nombreB,
  colorB,
  fecha,
  onOpen,
  onDelete,
}: PartidoCardProps) {
  const estadoColor =
    estado === 'ACTIVO' ? colors.success : estado === 'PAUSADO' ? colors.warning : colors.muted;

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.codigoSala}>Sala {codigoSala}</Text>
        <View style={[s.estadoPill, { borderColor: estadoColor }]}>
          <Text style={[s.estado, { color: estadoColor }]}>{estado}</Text>
        </View>
      </View>
      <View style={s.equiposRow}>
        <View style={s.equipoCol}>
          <View style={[s.colorDot, { backgroundColor: colorA }]} />
          <Text style={s.equipoNombre} numberOfLines={1}>
            {nombreA}
          </Text>
        </View>
        <Text style={s.vs}>vs</Text>
        <View style={s.equipoCol}>
          <View style={[s.colorDot, { backgroundColor: colorB }]} />
          <Text style={s.equipoNombre} numberOfLines={1}>
            {nombreB}
          </Text>
        </View>
      </View>
      {fecha ? <Text style={s.fecha}>{fecha}</Text> : null}
      <View style={s.cardActions}>
        <Pressable
          style={s.openBtn}
          onPress={() => onOpen(id)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir partido ${codigoSala}`}
        >
          <Text style={s.openBtnText}>Abrir marcador</Text>
        </Pressable>
        <Pressable
          style={s.deleteBtn}
          onPress={() => onDelete(id)}
          accessibilityRole="button"
          accessibilityLabel={`Eliminar partido ${codigoSala}`}
        >
          <Text style={s.deleteBtnText}>Eliminar</Text>
        </Pressable>
      </View>
    </View>
  );
});

export default function Dashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const {
    data: partidos,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['partidos'],
    queryFn: () => api.get<Partido[]>('/partidos'),
    enabled: !!token,
  });

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleOpen = useCallback(
    (id: string) => {
      router.push(`/partido/${id}`);
    },
    [router],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const objetivo = partidos?.find((p) => p.id === id);
      Alert.alert(
        'Eliminar partido',
        `¿Estás seguro de eliminar el partido "${objetivo?.equipos[0]?.nombre ?? 'A'} vs ${objetivo?.equipos[1]?.nombre ?? 'B'}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.delete(`/partidos/${id}`);
                await queryClient.invalidateQueries({ queryKey: ['partidos'] });
              } catch (err) {
                if (err instanceof ApiError) Alert.alert('Error', err.message);
                else Alert.alert('Error', 'No se pudo eliminar el partido.');
              }
            },
          },
        ],
      );
    },
    [partidos, queryClient],
  );

  const renderItem = useCallback(
    ({ item }: { item: Partido }) => (
      <PartidoCard
        id={item.id}
        codigoSala={item.codigoSala}
        estado={item.estado}
        nombreA={item.equipos[0]?.nombre ?? 'Equipo A'}
        colorA={item.equipos[0]?.colorHex ?? '#ccc'}
        nombreB={item.equipos[1]?.nombre ?? 'Equipo B'}
        colorB={item.equipos[1]?.colorHex ?? '#ccc'}
        fecha={item.createdAt ? `Creado ${formatFecha(item.createdAt)}` : ''}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />
    ),
    [handleOpen, handleDelete],
  );

  const keyExtractor = useCallback((item: Partido) => item.id, []);

  const errorMessage =
    error instanceof ApiError ? error.message : 'No se pudieron cargar los partidos.';

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting} accessibilityRole="header">
            Hola, {user?.nombre ?? 'Juez'}
          </Text>
          <Text style={s.headerSub}>Tus partidos</Text>
        </View>
        <Pressable
          onPress={handleLogout}
          style={s.logoutBtn}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Text style={s.logoutText}>Salir</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1E40AF" accessibilityLabel="Cargando partidos" />
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Text style={s.errorTitle}>No se pudo cargar</Text>
          <Text style={s.errorMessage}>{errorMessage}</Text>
          <Pressable
            style={s.retryBtn}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Reintentar cargar partidos"
          >
            <Text style={s.retryBtnText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={partidos ?? []}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyText}>Sin partidos</Text>
              <Text style={s.emptySubtext}>Crea tu primer partido con el botón azul</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        style={s.createBtn}
        onPress={() => router.push('/crear-partido')}
        accessibilityRole="button"
        accessibilityLabel="Crear nuevo partido"
      >
        <Text style={s.createBtnText}>+ Nuevo partido</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: { fontSize: 22, fontWeight: 'bold', color: colors.ink },
  headerSub: { color: colors.muted, marginTop: 2 },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: touch.minHeight,
    justifyContent: 'center',
  },
  logoutText: { color: colors.danger, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyText: { color: colors.muted, fontSize: 18, marginBottom: 4 },
  emptySubtext: { color: colors.faint },
  errorTitle: { color: colors.ink, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  errorMessage: { color: colors.muted, textAlign: 'center', paddingHorizontal: 32, marginBottom: 16 },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.md,
    ...curve,
    minHeight: 48,
    justifyContent: 'center',
  },
  retryBtnText: { color: 'white', fontWeight: '600' },
  listContent: { paddingHorizontal: 20, paddingBottom: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    ...curve,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codigoSala: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  estadoPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  estado: { fontSize: 11, fontWeight: '700' },
  equiposRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  equipoCol: { flex: 1, alignItems: 'center', gap: 4 },
  colorDot: { width: 18, height: 18, borderRadius: 9 },
  equipoNombre: { fontSize: 14, fontWeight: '600', color: colors.ink },
  vs: { fontSize: 13, fontWeight: '600', color: colors.faint, marginHorizontal: 16 },
  fecha: { color: colors.faint, fontSize: 12, marginTop: 8 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  openBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    ...curve,
    backgroundColor: colors.primary,
    alignItems: 'center',
    minHeight: touch.minHeight,
    justifyContent: 'center',
  },
  openBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    ...curve,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    minHeight: touch.minHeight,
    justifyContent: 'center',
  },
  deleteBtnText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  createBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.lg,
    ...curve,
    marginHorizontal: 20,
    marginBottom: 16,
    minHeight: 54,
    justifyContent: 'center',
  },
  createBtnText: { color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' },
});
