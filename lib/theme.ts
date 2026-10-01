import type { TextStyle } from 'react-native';

// Sistema de diseño: identidad de cancha.
// Una superficie clara y tranquila para formularios y listas, y un marcador
// oscuro de alto contraste como pieza memorable. Sin dependencias nuevas:
// StyleSheet + tokens compartidos (regla ui-styling).

export const colors = {
  // Superficies claras
  paper: '#F6F7F9',
  card: '#FFFFFF',
  line: '#E5E7EB',
  // Texto
  ink: '#111827',
  muted: '#4B5563',
  faint: '#6B7280',
  // Marca juez / espectador
  primary: '#1E40AF',
  primaryPressed: '#1E3A8A',
  spectator: '#C2410C',
  spectatorPressed: '#9A3412',
  // Semánticos
  danger: '#B91C1C',
  dangerBg: '#FEF2F2',
  dangerLine: '#FECACA',
  success: '#15803D',
  warning: '#92400E',
  warningBg: '#FFFBEB',
  warningLine: '#FDE68A',
  // Marcador oscuro
  board: '#0D1424',
  boardPanel: '#1A2338',
  boardLine: '#2A3654',
  onBoard: '#FFFFFF',
  onBoardMuted: '#C7D0E2',
  onBoardFaint: '#8B96B3',
  gold: '#FBBF24',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

// Curva continua en todos los radios: bordes más suaves y modernos
// (regla ui-styling de vercel-react-native-skills).
export const curve = { borderCurve: 'continuous' } as const;

export const touch = {
  minHeight: 44,
} as const;

// Escala tipográfica contenida: el peso y el color crean jerarquía,
// no una cascada de tamaños (regla ui-styling).
export const type: Record<
  'hero' | 'display' | 'title' | 'section' | 'body' | 'small' | 'tiny',
  Pick<TextStyle, 'fontSize' | 'fontWeight'>
> = {
  hero: { fontSize: 76, fontWeight: 'bold' },
  display: { fontSize: 28, fontWeight: 'bold' },
  title: { fontSize: 22, fontWeight: 'bold' },
  section: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  small: { fontSize: 13, fontWeight: '400' },
  tiny: { fontSize: 12, fontWeight: '400' },
};
