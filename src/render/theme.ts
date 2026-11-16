/**
 * Shared presentation palette for the neon vector CRT look.
 *
 * Keep this module renderer-only. Gameplay code must not import from it so the
 * deterministic simulation remains independent of visual choices.
 */
export const NEON = {
  void: '#02040a',
  phosphor: '#050a14',
  arena: '#07111f',
  arenaDeep: '#040812',
  panel: '#08111f',
  panelRaised: '#101c35',
  gridDim: '#163247',
  gridAccent: '#1e6b82',
  cyan: '#22d3ee',
  cyanBright: '#67e8f9',
  purple: '#a78bfa',
  purpleBright: '#c4b5fd',
  pink: '#f472b6',
  pinkBright: '#f9a8d4',
  amber: '#fbbf24',
  amberBright: '#fde68a',
  orange: '#fb923c',
  green: '#34d399',
  red: '#fb7185',
  white: '#f8fafc',
  text: '#dbeafe',
  textMuted: '#94a3b8',
  textDim: '#52627a',
  black: '#000000',
} as const;

export const ENEMY_COLORS: Record<string, string> = {
  turret: NEON.amber,
  lancer: NEON.amber,
  bomber: NEON.orange,
  weaver: NEON.purpleBright,
  spinner: NEON.pink,
  splitter: '#a3e635',
  charger: NEON.red,
  sentinel: NEON.green,
  mortar: NEON.amber,
  juggernaut: NEON.red,
  brute: NEON.orange,
  archer: NEON.cyan,
  shade: NEON.purple,
  prism: NEON.pinkBright,
  marauder: NEON.amberBright,
  voidling: NEON.cyanBright,
};

export const POWER_UP_COLORS: Record<string, string> = {
  missile: NEON.amber,
  speed: NEON.cyan,
  shield: NEON.green,
  blaster: NEON.purple,
  surge: NEON.cyanBright,
  health: NEON.red,
};

export const PROJECTILE_COLORS = {
  player: NEON.cyanBright,
  enemy: NEON.orange,
} as const;

export function withAlpha(hexColor: string, alpha: number): string {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const value = hexColor.replace('#', '');
  if (value.length !== 6 && value.length !== 3) return hexColor;

  const expanded =
    value.length === 3
      ? value
          .split('')
          .map((channel) => `${channel}${channel}`)
          .join('')
      : value;
  const numeric = Number.parseInt(expanded, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${clampedAlpha})`;
}
