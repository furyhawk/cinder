export interface TelegraphCue {
  /** Outer edge pulse alpha (0..1). */
  edgeAlpha: number;
  /** Outer edge stroke width in px. */
  edgeWidth: number;
  /** Expanding decal ring radius in px. */
  decalRadius: number;
  /** Decal ring alpha (0..1). */
  decalAlpha: number;
  /** Fill alpha for the incoming layout footprint (0..1). */
  hatchAlpha: number;
  /** 0 at start of telegraph, 1 at mutation. */
  progress: number;
}

export const DEFAULT_TELEGRAPH_MS = 1200;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Pure tick-time function used by the renderer and by presentation tests.
 * Three coordinated cues (edge pulse, decal ring, incoming footprint) give the
 * player three independent chances to read the incoming arena shape.
 */
export function computeTelegraphCue(
  remainingMs: number,
  totalMs = DEFAULT_TELEGRAPH_MS,
): TelegraphCue {
  const progress = clamp01(1 - remainingMs / Math.max(1, totalMs));
  const pulse = 0.55 + 0.45 * Math.sin(progress * Math.PI * 6);

  return {
    edgeAlpha: 0.35 + 0.55 * progress * pulse,
    edgeWidth: 2 + 4 * progress,
    decalRadius: 48 + 300 * progress,
    decalAlpha: 0.45 * (1 - progress) + 0.1,
    hatchAlpha: 0.06 + 0.16 * progress,
    progress,
  };
}
