import { describe, expect, it } from 'vitest';
import {
  UPGRADE_AXIS_LAYOUT,
  aimVectorFromPlayerToPointer,
  canvasPointFromClient,
  upgradeAxisIndexAt,
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

  it('matches five fixed-axis hitboxes to the rendered layout', () => {
    const fifthAxis = {
      x: UPGRADE_AXIS_LAYOUT.firstCardX + UPGRADE_AXIS_LAYOUT.cardStepX * 4 + 20,
      y: UPGRADE_AXIS_LAYOUT.firstCardY + 20,
    };
    expect(upgradeAxisIndexAt(fifthAxis, 5)).toBe(4);
    expect(upgradeAxisIndexAt({ x: 10, y: 10 }, 5)).toBe(-1);
  });
});
