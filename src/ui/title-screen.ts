import type { GamepadInput } from './gamepad';

export type GameScreenPhase = 'title' | 'playing';

export interface TitleScreenState {
  phase: GameScreenPhase;
}

export function createTitleScreenState(): TitleScreenState {
  return { phase: 'title' };
}

export function startGameFromTitle(state: TitleScreenState): boolean {
  if (state.phase !== 'title') return false;
  state.phase = 'playing';
  return true;
}

export function isTitleStartKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized === 'enter' || normalized === ' ' || normalized === 'spacebar';
}

export function isTitleStartGamepadInput(
  previous: GamepadInput,
  current: GamepadInput,
): boolean {
  if (!current.connected) return false;
  return (
    (current.confirm && !previous.confirm) ||
    (current.start && !previous.start)
  );
}
