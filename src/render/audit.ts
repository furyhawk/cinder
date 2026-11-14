export const PLAYER_PROJECTILE_HUE = 195;
export const ENEMY_PROJECTILE_HUE = 25;

export function hueDistance(a: number, b: number): number {
  const diff = Math.abs((a % 360) - (b % 360));
  return Math.min(diff, 360 - diff);
}
