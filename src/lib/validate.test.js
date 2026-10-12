import { describe, it, expect } from 'vitest';
import { validateStay } from './validate.js';

const today = '2026-10-12';

describe('validateStay', () => {
  it('accepts a normal finished stay, including a single day', () => {
    expect(validateStay({ entry: '2026-03-01', exit: '2026-03-10', ongoing: false }, today)).toBeNull();
    expect(validateStay({ entry: '2026-03-01', exit: '2026-03-01', ongoing: false }, today)).toBeNull();
  });

  it('requires an entry date', () => {
    expect(validateStay({ entry: '', exit: '', ongoing: false }, today)).toBe('err.required');
  });

  it('requires an exit date unless the stay is ongoing', () => {
    expect(validateStay({ entry: '2026-03-01', exit: '', ongoing: false }, today)).toBe('err.exitRequired');
    expect(validateStay({ entry: '2026-03-01', exit: null, ongoing: true }, today)).toBeNull();
  });

  it('rejects an exit before the entry', () => {
    expect(validateStay({ entry: '2026-03-10', exit: '2026-03-01', ongoing: false }, today)).toBe('err.exitBefore');
  });

  it('rejects an ongoing stay that starts in the future', () => {
    expect(validateStay({ entry: '2026-11-01', exit: null, ongoing: true }, today)).toBe('err.futureOngoing');
  });
});
