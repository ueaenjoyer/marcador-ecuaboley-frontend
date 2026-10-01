export interface Equipo {
  id: string;
  nombre: string;
  colorHex: string;
  orden: number;
  partidoId: string;
}

export interface SetQuince {
  id: string;
  numero: number;
  puntosEquipoA: number;
  puntosEquipoB: number;
  equipoConBatida: { id: string; nombre: string };
  equipoGanador: { id: string; nombre: string } | null;
  finalizado: boolean;
}

export interface Partido {
  id: string;
  codigoSala: string;
  puntosObjetivo: number;
  setsParaGanar: number;
  estado: 'ACTIVO' | 'PAUSADO' | 'FINALIZADO';
  creadorId: string;
  createdAt: string;
  latitud: number | null;
  longitud: number | null;
  ubicacionTexto: string | null;
  equipos: Equipo[];
  sets: SetQuince[];
  creador?: { id: string; nombre: string; email: string };
}

export interface RegistrarJugadaResponse {
  tipo: 'PUNTO' | 'CAMBIO';
  registroPuntoId: string;
  partido: Partido;
}
