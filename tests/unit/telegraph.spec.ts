import { describe, expect, it } from 'vitest';
import { computeTelegraphCue, DEFAULT_TELEGRAPH_MS } from '../../src/render/telegraph';

describe('arena telegraph cues', () => {
  it('starts subtle and finishes at full intensity', () => {
    const start = computeTelegraphCue(DEFAULT_TELEGRAPH_MS);
    const end = computeTelegraphCue(0);

    expect(start.progress).toBe(0);
    expect(end.progress).toBe(1);
    expect(end.edgeWidth).toBeGreaterThan(start.edgeWidth);
    expect(end.hatchAlpha).toBeGreaterThan(start.hatchAlpha);
    expect(end.decalRadius).toBeGreaterThan(start.decalRadius);
  });

  it('keeps every cue within renderable alpha bounds', () => {
    for (let remaining = DEFAULT_TELEGRAPH_MS; remaining >= 0; remaining -= 50) {
      const cue = computeTelegraphCue(remaining);
      expect(cue.edgeAlpha).toBeGreaterThanOrEqual(0);
      expect(cue.edgeAlpha).toBeLessThanOrEqual(1);
      expect(cue.decalAlpha).toBeGreaterThanOrEqual(0);
      expect(cue.decalAlpha).toBeLessThanOrEqual(1);
      expect(cue.hatchAlpha).toBeGreaterThanOrEqual(0);
      expect(cue.hatchAlpha).toBeLessThanOrEqual(1);
    }
  });

  it('clamps non-finite and out-of-range remaining times', () => {
    expect(computeTelegraphCue(-500).progress).toBe(1);
    expect(computeTelegraphCue(DEFAULT_TELEGRAPH_MS * 2).progress).toBe(0);
  });
});
