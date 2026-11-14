export type DamageKind = 'projectile' | 'contact' | 'arena' | 'boss_pattern' | 'self';

export interface Damageable {
  hp: number;
  invulnerableTicks: number;
}

export interface DamageResult {
  applied: boolean;
  amount: number;
  killed: boolean;
  remainingHp: number;
}

export function damage(
  target: Damageable,
  amount: number,
  _source: string,
  kind: DamageKind,
): DamageResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { applied: false, amount: 0, killed: false, remainingHp: target.hp };
  }

  if (target.invulnerableTicks > 0) {
    return { applied: false, amount: 0, killed: false, remainingHp: target.hp };
  }

  const nextHp = Math.max(0, target.hp - amount);
  target.hp = nextHp;

  if (kind !== 'self') {
    target.invulnerableTicks = 1;
  }

  return {
    applied: true,
    amount,
    killed: nextHp <= 0,
    remainingHp: nextHp,
  };
}
