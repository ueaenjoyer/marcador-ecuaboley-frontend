import { describe, expect, it } from 'vitest';
import {
  getLoginFieldErrors,
  getRegisterFieldErrors,
  validateCodigoSala,
  validateLoginForm,
  validateRegisterForm,
} from './validation';

describe('validateLoginForm', () => {
  it('rejects missing fields', () => {
    expect(validateLoginForm('', '')).toBe('El email es obligatorio.');
    expect(validateLoginForm('user@example.com', '')).toBe('La contraseña es obligatoria.');
  });

  it('rejects malformed email and short password', () => {
    expect(validateLoginForm('invalid-email', 'secret')).toBe('Ingresa un email válido.');
    expect(validateLoginForm('user@example.com', '12345')).toBe(
      'La contraseña debe tener al menos 6 caracteres.',
    );
  });

  it('accepts valid credentials', () => {
    expect(validateLoginForm('user@example.com', 'secret1')).toBeNull();
  });
});

describe('validateRegisterForm', () => {
  it('rejects missing fields and malformed email', () => {
    expect(validateRegisterForm('', '', '')).toBe('El nombre es obligatorio.');
    expect(validateRegisterForm('Ana', 'invalid-email', 'secret1')).toBe(
      'Ingresa un email válido.',
    );
  });

  it('requires a minimum name length', () => {
    expect(validateRegisterForm('A', 'user@example.com', 'secret1')).toBe(
      'El nombre debe tener al menos 2 caracteres.',
    );
  });

  it('rejects a short password', () => {
    expect(validateRegisterForm('Ana', 'user@example.com', '12345')).toBe(
      'La contraseña debe tener al menos 6 caracteres.',
    );
  });

  it('accepts valid registration data', () => {
    expect(validateRegisterForm('Ana', 'user@example.com', 'secret1')).toBeNull();
  });
});

describe('getLoginFieldErrors', () => {
  it('marks each invalid field independently', () => {
    expect(getLoginFieldErrors('', '')).toEqual({
      email: 'El email es obligatorio.',
      password: 'La contraseña es obligatoria.',
    });
    expect(getLoginFieldErrors('mal', '12345')).toEqual({
      email: 'Ingresa un email válido.',
      password: 'La contraseña debe tener al menos 6 caracteres.',
    });
  });

  it('returns no errors for valid data', () => {
    expect(getLoginFieldErrors('user@example.com', 'secret1')).toEqual({});
  });
});

describe('getRegisterFieldErrors', () => {
  it('marks nombre, email and password independently', () => {
    expect(getRegisterFieldErrors('', 'mal', '123')).toEqual({
      nombre: 'El nombre es obligatorio.',
      email: 'Ingresa un email válido.',
      password: 'La contraseña debe tener al menos 6 caracteres.',
    });
  });

  it('returns no errors for valid data', () => {
    expect(getRegisterFieldErrors('Ana', 'user@example.com', 'secret1')).toEqual({});
  });
});

describe('validateCodigoSala', () => {
  it('rejects empty and malformed codes', () => {
    expect(validateCodigoSala('')).toBe('Ingresa un código de sala válido.');
    expect(validateCodigoSala('ABC')).toBe(
      'El código de sala tiene 6 letras o números (ej. ABC123).',
    );
    expect(validateCodigoSala('ABC-12')).toBe(
      'El código de sala tiene 6 letras o números (ej. ABC123).',
    );
  });

  it('accepts a 6-char alphanumeric code', () => {
    expect(validateCodigoSala('abc123')).toBeNull();
    expect(validateCodigoSala('XYZ789')).toBeNull();
  });
});
