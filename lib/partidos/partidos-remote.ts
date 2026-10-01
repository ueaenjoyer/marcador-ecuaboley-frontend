// Fuente remota — única que toca api.* (cliente HTTP único).
// Las pantallas NO deben importar este archivo; usan partidos-repository.ts.

import { api } from '../api';
import { partidoFromJson } from '../models/partido';
import type { Partido, RegistrarJugadaResponse } from '../types';
import type { CallOptions } from '../api';

export interface CrearPartidoPayload {
  equipoA: { nombre: string; colorHex: string };
  equipoB: { nombre: string; colorHex: string };
  puntosObjetivo: number;
  setsParaGanar: number;
  latitud?: number;
  longitud?: number;
  ubicacionTexto?: string;
}

export const remoteListPartidos = async (opts?: CallOptions): Promise<Partido[]> => {
  const raw = await api.get<unknown[]>('/partidos', opts);
  return (Array.isArray(raw) ? raw : []).map(partidoFromJson);
};

export const remoteGetPartido = async (id: string, opts?: CallOptions): Promise<Partido> =>
  partidoFromJson(await api.get<unknown>(`/partidos/${id}`, opts));

export const remoteGetPorSala = async (codigo: string, opts?: CallOptions): Promise<Partido> =>
  partidoFromJson(await api.get<unknown>(`/partidos/sala/${codigo}`, opts));

export const remoteCrearPartido = async (
  payload: CrearPartidoPayload,
  opts?: CallOptions,
): Promise<Partido> => partidoFromJson(await api.post<unknown>('/partidos', payload, opts));

export const remoteRegistrarJugada = async (
  partidoId: string,
  equipoGanadorJugadaId: string,
  opts?: CallOptions,
): Promise<RegistrarJugadaResponse> =>
  api.post<RegistrarJugadaResponse>(
    `/partidos/${partidoId}/punto`,
    { equipoGanadorJugadaId },
    opts,
  );

export const remoteUndo = async (partidoId: string, opts?: CallOptions): Promise<Partido> =>
  partidoFromJson(await api.post<unknown>(`/partidos/${partidoId}/undo`, undefined, opts));

export const remoteSiguienteSet = async (
  partidoId: string,
  opts?: CallOptions,
): Promise<Partido> =>
  partidoFromJson(await api.post<unknown>(`/partidos/${partidoId}/siguiente-set`, undefined, opts));

export const remoteCambiarEstado = async (
  partidoId: string,
  estado: 'ACTIVO' | 'PAUSADO',
  opts?: CallOptions,
): Promise<Partido> =>
  partidoFromJson(await api.patch<unknown>(`/partidos/${partidoId}`, { estado }, opts));

export const remoteEliminarPartido = async (id: string, opts?: CallOptions): Promise<void> =>
  api.delete(`/partidos/${id}`, opts);
