import { describe, expect, it } from 'vitest';
import { createRunId } from '../../src/telemetry/run-id';

describe('telemetry run id', () => {
  it('uses a provided UUID source when available', () => {
    expect(createRunId({ randomUUID: () => '1234-5678' })).toBe('run-1234-5678');
  });

  it('falls back safely when crypto.randomUUID is unavailable', () => {
    const id = createRunId({
      randomUUID: null,
      now: () => 1700000000000,
      random: () => 0.5,
    });

    expect(id).toMatch(/^run-[a-z0-9]+-[a-z0-9]+$/);
  });
});
