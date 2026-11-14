import { describe, expect, it } from 'vitest';
import { ENEMY_PROJECTILE_HUE, hueDistance, PLAYER_PROJECTILE_HUE } from '../../src/render/audit';

describe('readability invariants', () => {
  it('keeps enemy projectile hue at least 120 degrees away from player projectile hue', () => {
    expect(hueDistance(PLAYER_PROJECTILE_HUE, ENEMY_PROJECTILE_HUE)).toBeGreaterThanOrEqual(120);
  });
});
