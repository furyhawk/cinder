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

export interface UpgradeCardLayout {
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

export const UPGRADE_CARD_LAYOUT: UpgradeCardLayout = {
  panelX: 252,
  panelY: 180,
  panelWidth: 776,
  panelHeight: 220,
  firstCardX: 276,
  firstCardY: 240,
  cardWidth: 200,
  cardHeight: 120,
  cardStepX: 240,
};

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

export function upgradeCardIndexAt(point: Point, count: number): number {
  for (let index = 0; index < count; index += 1) {
    const x = UPGRADE_CARD_LAYOUT.firstCardX + index * UPGRADE_CARD_LAYOUT.cardStepX;
    const y = UPGRADE_CARD_LAYOUT.firstCardY;
    if (
      point.x >= x &&
      point.x <= x + UPGRADE_CARD_LAYOUT.cardWidth &&
      point.y >= y &&
      point.y <= y + UPGRADE_CARD_LAYOUT.cardHeight
    ) {
      return index;
    }
  }
  return -1;
}
