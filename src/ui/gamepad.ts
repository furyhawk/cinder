export interface GamepadButtonSnapshot {
  pressed: boolean;
  value?: number;
}

export interface GamepadSnapshot {
  axes: readonly number[];
  buttons: readonly GamepadButtonSnapshot[];
}

export interface GamepadInput {
  connected: boolean;
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  hasAim: boolean;
  fire: boolean;
  surge: boolean;
  menuPrevious: boolean;
  menuNext: boolean;
  confirm: boolean;
  start: boolean;
}

export const EMPTY_GAMEPAD_INPUT: GamepadInput = {
  connected: false,
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  hasAim: false,
  fire: false,
  surge: false,
  menuPrevious: false,
  menuNext: false,
  confirm: false,
  start: false,
};

const STICK_DEADZONE = 0.22;
const TRIGGER_THRESHOLD = 0.2;

function buttonAt(snapshot: GamepadSnapshot, index: number): GamepadButtonSnapshot {
  return snapshot.buttons[index] ?? { pressed: false, value: 0 };
}

function buttonPressed(snapshot: GamepadSnapshot, index: number): boolean {
  const button = buttonAt(snapshot, index);
  return button.pressed || (button.value ?? 0) > TRIGGER_THRESHOLD;
}

function axisAt(snapshot: GamepadSnapshot, index: number): number {
  const value = snapshot.axes[index] ?? 0;
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

function radialStick(x: number, y: number): { x: number; y: number; magnitude: number } {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= STICK_DEADZONE) {
    return { x: 0, y: 0, magnitude: 0 };
  }

  const normalizedMagnitude = Math.min(1, (magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE));
  return {
    x: (x / magnitude) * normalizedMagnitude,
    y: (y / magnitude) * normalizedMagnitude,
    magnitude: normalizedMagnitude,
  };
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function mapGamepad(snapshot: GamepadSnapshot | null | undefined): GamepadInput {
  if (!snapshot) return EMPTY_GAMEPAD_INPUT;

  const left = radialStick(axisAt(snapshot, 0), axisAt(snapshot, 1));
  const right = radialStick(axisAt(snapshot, 2), axisAt(snapshot, 3));
  const dpadX = (buttonPressed(snapshot, 15) ? 1 : 0) - (buttonPressed(snapshot, 14) ? 1 : 0);
  const dpadY = (buttonPressed(snapshot, 13) ? 1 : 0) - (buttonPressed(snapshot, 12) ? 1 : 0);

  return {
    connected: true,
    moveX: clampAxis(left.x + dpadX),
    moveY: clampAxis(left.y + dpadY),
    aimX: right.x,
    aimY: right.y,
    hasAim: right.magnitude > 0,
    fire: buttonPressed(snapshot, 0) || (buttonAt(snapshot, 7).value ?? 0) > TRIGGER_THRESHOLD,
    surge: buttonPressed(snapshot, 1) || buttonPressed(snapshot, 5),
    menuPrevious: buttonPressed(snapshot, 14),
    menuNext: buttonPressed(snapshot, 15),
    confirm: buttonPressed(snapshot, 0),
    start: buttonPressed(snapshot, 9),
  };
}
