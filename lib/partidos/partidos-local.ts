// Fuente local — cache del último estado visto (no SQLite).
//
// Por qué no hay escritura offline de punto/undo:
// el servidor es el árbitro supremo; encolar jugadas offline duplicaría
// o desordenaría el marcador. La fuente local solo guarda lectura para
// mostrar algo coherente sin red. Los tokens (Semana 12) sí viven en
// SecureStore vía auth-store.ts.

import type { Partido } from '../types';

let lastPartidoById = new Map<string, Partido>();
let lastList: Partido[] | null = null;

export const savePartidoSnapshot = (p: Partido): void => {
  lastPartidoById.set(p.id, p);
  lastPartidoById.set(p.codigoSala, p);
};

export const getPartidoSnapshot = (key: string): Partido | null =>
  lastPartidoById.get(key) ?? null;

export const saveListSnapshot = (list: Partido[]): void => {
  lastList = list;
};

export const getListSnapshot = (): Partido[] | null => lastList;

export const clearLocalSnapshots = (): void => {
  lastPartidoById = new Map();
  lastList = null;
};
