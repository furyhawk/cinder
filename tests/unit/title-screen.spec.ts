import { describe, expect, it } from 'vitest';
import { EMPTY_GAMEPAD_INPUT, type GamepadInput } from '../../src/ui/gamepad';
import {
  createTitleScreenState,
  isTitleStartGamepadInput,
  isTitleStartKey,
  startGameFromTitle,
} from '../../src/ui/title-screen';

function gamepad(overrides: Partial<GamepadInput> = {}): GamepadInput {
  return { ...EMPTY_GAMEPAD_INPUT, connected: true, ...overrides };
}

describe('title screen', () => {
  it('starts on the title screen and only transitions once', () => {
    const screen = createTitleScreenState();

    expect(screen.phase).toBe('title');
    expect(startGameFromTitle(screen)).toBe(true);
    expect(screen.phase).toBe('playing');
    expect(startGameFromTitle(screen)).toBe(false);
  });

  it('accepts keyboard and pointer start inputs', () => {
    expect(isTitleStartKey('Enter')).toBe(true);
    expect(isTitleStartKey(' ')).toBe(true);
    expect(isTitleStartKey('a')).toBe(false);
  });

  it('starts on a new gamepad confirm or start press', () => {
    expect(isTitleStartGamepadInput(EMPTY_GAMEPAD_INPUT, gamepad({ confirm: true }))).toBe(true);
    expect(isTitleStartGamepadInput(EMPTY_GAMEPAD_INPUT, gamepad({ start: true }))).toBe(true);
    expect(isTitleStartGamepadInput(gamepad({ confirm: true }), gamepad({ confirm: true }))).toBe(false);
  });
});
