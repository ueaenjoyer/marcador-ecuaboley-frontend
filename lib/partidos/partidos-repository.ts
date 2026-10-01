// Repositorio — única puerta que usan las pantallas.
// Articula remota + local + cola Semana 12 (sesión en SecureStore):
// - Lecturas: intentan remoto (con reintento GET en api.ts); si hay fallo de
//   red/timeout/5xx y existe snapshot, devuelven snapshot + flag offline.
// - Escrituras (punto/undo/crear): nunca usan snapshot ni reintentan;
//   el error se traduce a mensaje de dominio y la UI no aplica cambios.
// - Cancelación: el signal se propaga (usuario abandona pantalla → abort).

import { ApiError, toDomainMessage } from '../api';
import type { CallOptions } from '../api';
import type { Partido, RegistrarJugadaResponse } from '../types';
import * as remote from './partidos-remote';
import {
  getListSnapshot,
  getPartidoSnapshot,
  saveListSnapshot,
  savePartidoSnapshot,
} from './partidos-local';
import type { CrearPartidoPayload } from './partidos-remote';

export interface ReadResult<T> {
  data: T;
  offline: boolean;
}

const isOfflineCapable = (err: unknown): boolean => {
  if (err instanceof ApiError) {
    return err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT' || err.status >= 500 || err.status === 0;
  }
  return err instanceof TypeError || (err instanceof Error && err.name === 'AbortError');
};

export const repoListPartidos = async (opts?: CallOptions): Promise<ReadResult<Partido[]>> => {
  try {
    const data = await remote.remoteListPartidos(opts);
    saveListSnapshot(data);
    return { data, offline: false };
  } catch (err) {
    if (opts?.signal?.aborted) throw err;
    const cached = getListSnapshot();
    if (cached && isOfflineCapable(err)) return { data: cached, offline: true };
    throw new Error(toDomainMessage(err));
  }
};

export const repoGetPartido = async (
  id: string,
  opts?: CallOptions,
): Promise<ReadResult<Partido>> => {
  try {
    const data = await remote.remoteGetPartido(id, opts);
    savePartidoSnapshot(data);
    return { data, offline: false };
  } catch (err) {
    if (opts?.signal?.aborted) throw err;
    const cached = getPartidoSnapshot(id);
    if (cached && isOfflineCapable(err)) return { data: cached, offline: true };
    throw new Error(toDomainMessage(err));
  }
};

export const repoGetPorSala = async (
  codigo: string,
  opts?: CallOptions,
): Promise<ReadResult<Partido>> => {
  try {
    const data = await remote.remoteGetPorSala(codigo, opts);
    savePartidoSnapshot(data);
    return { data, offline: false };
  } catch (err) {
    if (opts?.signal?.aborted) throw err;
    const cached = getPartidoSnapshot(codigo.toUpperCase());
    if (cached && isOfflineCapable(err)) return { data: cached, offline: true };
    throw new Error(toDomainMessage(err));
  }
};

export const repoCrearPartido = async (
  payload: CrearPartidoPayload,
  opts?: CallOptions,
): Promise<Partido> => {
  try {
    const data = await remote.remoteCrearPartido(payload, opts);
    savePartidoSnapshot(data);
    return data;
  } catch (err) {
    if (opts?.signal?.aborted) throw err;
    throw new Error(toDomainMessage(err));
  }
};

// Escrituras del marcador: sin reintento, sin snapshot. Si fallan, la UI
// no debe aplicar cambios optimistas.
export const repoRegistrarJugada = async (
  partidoId: string,
  equipoGanadorJugadaId: string,
  opts?: CallOptions,
): Promise<RegistrarJugadaResponse> => {
  try {
    return await remote.remoteRegistrarJugada(partidoId, equipoGanadorJugadaId, opts);
  } catch (err) {
    if (opts?.signal?.aborted) throw err;
    throw new Error(toDomainMessage(err));
  }
};

export const repoUndo = async (partidoId: string, opts?: CallOptions): Promise<Partido> => {
  try {
    return await remote.remoteUndo(partidoId, opts);
  } catch (err) {
    if (opts?.signal?.aborted) throw err;
    throw new Error(toDomainMessage(err));
  }
};

export const repoSiguienteSet = async (
  partidoId: string,
  opts?: CallOptions,
): Promise<Partido> => {
  try {
    return await remote.remoteSiguienteSet(partidoId, opts);
  } catch (err) {
    if (opts?.signal?.aborted) throw err;
    throw new Error(toDomainMessage(err));
  }
};

export const repoCambiarEstado = async (
  partidoId: string,
  estado: 'ACTIVO' | 'PAUSADO',
  opts?: CallOptions,
): Promise<Partido> => {
  try {
    return await remote.remoteCambiarEstado(partidoId, estado, opts);
  } catch (err) {
    if (opts?.signal?.aborted) throw err;
    throw new Error(toDomainMessage(err));
  }
};

export const repoEliminarPartido = async (id: string, opts?: CallOptions): Promise<void> => {
  try {
    await remote.remoteEliminarPartido(id, opts);
  } catch (err) {
    if (opts?.signal?.aborted) throw err;
    throw new Error(toDomainMessage(err));
  }
};
