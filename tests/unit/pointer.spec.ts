import { describe, expect, it } from 'vitest';
import {
  UPGRADE_CARD_LAYOUT,
  aimVectorFromPlayerToPointer,
  canvasPointFromClient,
  upgradeCardIndexAt,
} from '../../src/ui/pointer';

describe('pointer mapping', () => {
  it('aims from the player position instead of a fixed canvas centre', () => {
    expect(aimVectorFromPlayerToPointer({ x: 100, y: 100 }, { x: 200, y: 100 })).toEqual({
      x: 1,
      y: 0,
    });
    expect(aimVectorFromPlayerToPointer({ x: 100, y: 100 }, { x: 100, y: 200 })).toEqual({
      x: 0,
      y: 1,
    });
  });

  it('maps client coordinates through the canvas CSS transform', () => {
    expect(
      canvasPointFromClient(370, 200, { left: 50, top: 20, width: 640, height: 360 }, 1280, 720),
    ).toEqual({ x: 640, y: 360 });
  });

  it('matches upgrade-card hitboxes to the rendered layout', () => {
    const secondCard = {
      x: UPGRADE_CARD_LAYOUT.firstCardX + UPGRADE_CARD_LAYOUT.cardStepX + 20,
      y: UPGRADE_CARD_LAYOUT.firstCardY + 20,
    };
    expect(upgradeCardIndexAt(secondCard, 3)).toBe(1);
    expect(upgradeCardIndexAt({ x: 10, y: 10 }, 3)).toBe(-1);
  });
});
