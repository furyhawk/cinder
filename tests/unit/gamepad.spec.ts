import { describe, expect, it } from 'vitest';
import { EMPTY_GAMEPAD_INPUT, mapGamepad, type GamepadSnapshot } from '../../src/ui/gamepad';

function snapshot(
  axes: number[],
  pressedButtons: number[] = [],
  triggerValues: Record<number, number> = {},
): GamepadSnapshot {
  return {
    axes,
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: pressedButtons.includes(index),
      value: triggerValues[index] ?? (pressedButtons.includes(index) ? 1 : 0),
    })),
  };
}

describe('gamepad mapping', () => {
  it('returns an empty input when no controller is connected', () => {
    expect(mapGamepad(null)).toEqual(EMPTY_GAMEPAD_INPUT);
  });

  it('maps movement, right-stick aim/fire, and Surge', () => {
    const input = mapGamepad(snapshot([0.8, 0, 0, -1], [1]));

    expect(input.connected).toBe(true);
    expect(input.moveX).toBeGreaterThan(0.7);
    expect(input.moveY).toBe(0);
    expect(input.hasAim).toBe(true);
    expect(input.aimX).toBe(0);
    expect(input.aimY).toBe(-1);
    expect(input.fire).toBe(true);
    expect(input.surge).toBe(true);
  });

  it('automatically fires while the right stick is aiming', () => {
    const input = mapGamepad(snapshot([0, 0, 1, 0]));

    expect(input.hasAim).toBe(true);
    expect(input.fire).toBe(true);
  });

  it('does not use the A/confirm button to fire', () => {
    const input = mapGamepad(snapshot([0, 0, 0, 0], [0]));

    expect(input.fire).toBe(false);
    expect(input.confirm).toBe(true);
  });

  it('applies a radial deadzone and maps D-pad menu navigation', () => {
    const deadzoned = mapGamepad(snapshot([0.1, -0.1, 0, 0]));
    expect(deadzoned.moveX).toBe(0);
    expect(deadzoned.moveY).toBe(0);
    expect(deadzoned.hasAim).toBe(false);

    const menu = mapGamepad(snapshot([0, 0, 0, 0], [0, 14, 15, 9]));
    expect(menu.menuPrevious).toBe(true);
    expect(menu.menuNext).toBe(true);
    expect(menu.confirm).toBe(true);
    expect(menu.start).toBe(true);
  });
});
