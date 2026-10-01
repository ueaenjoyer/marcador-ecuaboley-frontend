// Modelo Partido + Equipo + SetQuince — 2ª entidad exigida (cubre 3 tipos).
// Reglas Prototipo 13:
// - Opcionales del contrato → `| null` explícito.
// - Cada divergencia de nomenclatura servidor↔cliente → anotación @divergencia.

import type { Equipo, Partido, SetQuince } from '../types';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

const asString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNumber = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
// @divergencia: campos opcionales del servidor (null) → null explícito en cliente.
const asNullableNumber = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const asNullableString = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export const equipoFromJson = (json: unknown): Equipo => {
  if (!isRecord(json)) throw new Error('Equipo inválido.');
  const partidoId = asString(json.partidoId);
  if (typeof json.id !== 'string' || !partidoId) throw new Error('Equipo inválido: ids.');
  return {
    id: json.id,
    // @divergencia: servidor acepta nombre '' → cliente muestra fallback por color.
    nombre: asString(json.nombre),
    colorHex: asString(json.colorHex),
    orden: asNumber(json.orden),
    partidoId,
  };
};

export const setQuinceFromJson = (json: unknown): SetQuince => {
  if (!isRecord(json)) throw new Error('Set inválido.');
  if (typeof json.id !== 'string' || typeof json.numero !== 'number') {
    throw new Error('Set inválido: id/numero.');
  }
  // @divergencia: servidor guarda equipoConBatidaId (FK string);
  // cliente recibe objeto poblado equipoConBatida{id,nombre}.
  const batidaRaw = isRecord(json.equipoConBatida) ? json.equipoConBatida : null;
  const ganadorRaw = isRecord(json.equipoGanador) ? json.equipoGanador : null;
  return {
    id: json.id as string,
    numero: json.numero as number,
    puntosEquipoA: asNumber(json.puntosEquipoA),
    puntosEquipoB: asNumber(json.puntosEquipoB),
    equipoConBatida: {
      id: asString(batidaRaw?.id),
      nombre: asString(batidaRaw?.nombre),
    },
    // @divergencia: equipoGanadorId null en servidor → equipoGanador null en cliente.
    equipoGanador:
      ganadorRaw && typeof ganadorRaw.id === 'string'
        ? { id: ganadorRaw.id, nombre: asString(ganadorRaw.nombre) }
        : null,
    finalizado: json.finalizado === true,
  };
};

export const partidoFromJson = (json: unknown): Partido => {
  if (!isRecord(json)) throw new Error('Partido inválido.');
  if (typeof json.id !== 'string' || typeof json.codigoSala !== 'string') {
    throw new Error('Partido inválido: id/codigoSala.');
  }
  const equiposRaw = Array.isArray(json.equipos) ? json.equipos : [];
  const setsRaw = Array.isArray(json.sets) ? json.sets : [];
  return {
    id: json.id,
    codigoSala: json.codigoSala,
    puntosObjetivo: asNumber(json.puntosObjetivo, 15),
    setsParaGanar: asNumber(json.setsParaGanar, 2),
    estado: json.estado === 'PAUSADO' || json.estado === 'FINALIZADO' ? json.estado : 'ACTIVO',
    creadorId: asString(json.creadorId),
    createdAt: asString(json.createdAt),
    latitud: asNullableNumber(json.latitud),
    longitud: asNullableNumber(json.longitud),
    ubicacionTexto: asNullableString(json.ubicacionTexto),
    equipos: equiposRaw.map(equipoFromJson),
    sets: setsRaw.map(setQuinceFromJson),
    // @divergencia: creador solo viene poblado en detalle; en listado es null.
    creador: isRecord(json.creador)
      ? {
          id: asString(json.creador.id),
          nombre: asString(json.creador.nombre),
          email: asString(json.creador.email),
        }
      : undefined,
  };
};
