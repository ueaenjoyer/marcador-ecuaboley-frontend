const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODIGO_SALA_PATTERN = /^[A-Z0-9]{6}$/;

export const validateLoginForm = (email: string, password: string): string | null => {
  if (!email.trim()) return 'El email es obligatorio.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Ingresa un email válido.';
  if (!password.trim()) return 'La contraseña es obligatoria.';
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  return null;
};

export const validateRegisterForm = (
  nombre: string,
  email: string,
  password: string,
): string | null => {
  if (!nombre.trim()) return 'El nombre es obligatorio.';
  if (nombre.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres.';
  if (!email.trim()) return 'El email es obligatorio.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Ingresa un email válido.';
  if (!password.trim()) return 'La contraseña es obligatoria.';
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  return null;
};

export interface LoginFieldErrors {
  email?: string;
  password?: string;
}

export const getLoginFieldErrors = (email: string, password: string): LoginFieldErrors => {
  const errors: LoginFieldErrors = {};
  if (!email.trim()) errors.email = 'El email es obligatorio.';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Ingresa un email válido.';
  if (!password) errors.password = 'La contraseña es obligatoria.';
  else if (password.length < 6)
    errors.password = 'La contraseña debe tener al menos 6 caracteres.';
  return errors;
};

export interface RegisterFieldErrors {
  nombre?: string;
  email?: string;
  password?: string;
}

export const getRegisterFieldErrors = (
  nombre: string,
  email: string,
  password: string,
): RegisterFieldErrors => {
  const errors: RegisterFieldErrors = {};
  if (!nombre.trim()) errors.nombre = 'El nombre es obligatorio.';
  else if (nombre.trim().length < 2)
    errors.nombre = 'El nombre debe tener al menos 2 caracteres.';
  if (!email.trim()) errors.email = 'El email es obligatorio.';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Ingresa un email válido.';
  if (!password) errors.password = 'La contraseña es obligatoria.';
  else if (password.length < 6)
    errors.password = 'La contraseña debe tener al menos 6 caracteres.';
  return errors;
};

export const validateCodigoSala = (codigo: string): string | null => {
  const limpio = codigo.trim().toUpperCase();
  if (!limpio) return 'Ingresa un código de sala válido.';
  if (!CODIGO_SALA_PATTERN.test(limpio))
    return 'El código de sala tiene 6 letras o números (ej. ABC123).';
  return null;
};
