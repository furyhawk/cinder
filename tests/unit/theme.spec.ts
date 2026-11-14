import { describe, expect, it } from 'vitest';
import { NEON, POWER_UP_COLORS, withAlpha } from '../../src/render/theme';

describe('neon CRT theme palette', () => {
  it('exposes the shared neon and phosphor colors', () => {
    expect(NEON.cyan).toBe('#22d3ee');
    expect(NEON.purple).toBe('#a78bfa');
    expect(NEON.pink).toBe('#f472b6');
    expect(NEON.amber).toBe('#fbbf24');
    expect(NEON.phosphor).toBe('#050a14');
  });

  it('builds alpha colors and keeps power-up accents theme-aligned', () => {
    expect(withAlpha(NEON.cyan, 0.25)).toBe('rgba(34, 211, 238, 0.25)');
    expect(withAlpha(NEON.pink, 2)).toBe('rgba(244, 114, 182, 1)');
    expect(POWER_UP_COLORS.blaster).toBe(NEON.purple);
    expect(POWER_UP_COLORS.surge).toBe(NEON.cyanBright);
  });
});
