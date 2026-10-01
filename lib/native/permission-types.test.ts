import { describe, it, expect } from 'vitest';
import { isGranted, canRetry, isPermanentlyDenied } from './permission-types';

describe('permission-types', () => {
  it('reconoce el permiso concedido', () => {
    expect(isGranted({ status: 'granted', canAskAgain: false })).toBe(true);
    expect(canRetry({ status: 'granted', canAskAgain: false })).toBe(false);
    expect(isPermanentlyDenied({ status: 'granted', canAskAgain: false })).toBe(false);
  });

  it('reconoce el rechazo con reintento', () => {
    expect(canRetry({ status: 'denied', canAskAgain: true })).toBe(true);
    expect(isPermanentlyDenied({ status: 'denied', canAskAgain: true })).toBe(false);
    expect(isGranted({ status: 'denied', canAskAgain: true })).toBe(false);
  });

  it('reconoce la denegación permanente', () => {
    expect(isPermanentlyDenied({ status: 'denied', canAskAgain: false })).toBe(true);
    expect(canRetry({ status: 'denied', canAskAgain: false })).toBe(false);
  });

  it('trata undetermined como no concedido', () => {
    const state = { status: 'undetermined' as const, canAskAgain: true };
    expect(isGranted(state)).toBe(false);
    expect(canRetry(state)).toBe(false);
    expect(isPermanentlyDenied(state)).toBe(false);
  });
});
