export interface Point {
  x: number;
  y: number;
}

export interface CanvasRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface UpgradeAxisLayout {
  panelX: number;
  panelY: number;
  panelWidth: number;
  panelHeight: number;
  firstCardX: number;
  firstCardY: number;
  cardWidth: number;
  cardHeight: number;
  cardStepX: number;
}

export type UpgradeCardLayout = UpgradeAxisLayout;

// The lowest playable arena coordinate is y=640. Keep the upgrade strip below
// that line so its panel never obscures player, enemy, or pickup sprites.
export const UPGRADE_AXIS_LAYOUT: UpgradeAxisLayout = {
  panelX: 40,
  panelY: 650,
  panelWidth: 1200,
  panelHeight: 64,
  firstCardX: 172,
  firstCardY: 658,
  cardWidth: 208,
  cardHeight: 48,
  cardStepX: 212,
};

/** Backwards-compatible alias for callers migrated from the card system. */
export const UPGRADE_CARD_LAYOUT = UPGRADE_AXIS_LAYOUT;

export function canvasPointFromClient(
  clientX: number,
  clientY: number,
  rect: CanvasRectLike,
  canvasWidth: number,
  canvasHeight: number,
): Point {
  return {
    x: ((clientX - rect.left) / rect.width) * canvasWidth,
    y: ((clientY - rect.top) / rect.height) * canvasHeight,
  };
}

export function aimVectorFromPlayerToPointer(player: Point, pointer: Point): Point {
  const dx = pointer.x - player.x;
  const dy = pointer.y - player.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 1, y: 0 };
  return { x: dx / length, y: dy / length };
}

export function upgradeAxisIndexAt(point: Point, count: number): number {
  for (let index = 0; index < count; index += 1) {
    const x = UPGRADE_AXIS_LAYOUT.firstCardX + index * UPGRADE_AXIS_LAYOUT.cardStepX;
    const y = UPGRADE_AXIS_LAYOUT.firstCardY;
    if (
      point.x >= x &&
      point.x <= x + UPGRADE_AXIS_LAYOUT.cardWidth &&
      point.y >= y &&
      point.y <= y + UPGRADE_AXIS_LAYOUT.cardHeight
    ) {
      return index;
    }
  }
  return -1;
}

/** Backwards-compatible alias for callers migrated from the card system. */
export const upgradeCardIndexAt = upgradeAxisIndexAt;
