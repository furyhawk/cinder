export interface InputFrame {
  tick: number;
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  fire: boolean;
  surge: boolean;
}

export interface SimEvent {
  type: 'tick';
  tick: number;
  x?: number;
  y?: number;
  data?: Record<string, number | string>;
}

export interface WorldState {
  tick: number;
  dot: {
    x: number;
    y: number;
  };
}

export interface World {
  state: WorldState;
  step(input: InputFrame): SimEvent[];
  hash(): string;
}

export function createInputFrame(
  tick: number,
  overrides: Partial<InputFrame> = {},
): InputFrame {
  return {
    tick,
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    fire: false,
    surge: false,
    ...overrides,
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const sorted = Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = (value as Record<string, unknown>)[key];
      return acc;
    }, {});

    return `{${Object.keys(sorted).map((key) => `${JSON.stringify(key)}:${stableStringify(sorted[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

export function createWorld(seed = 'default-seed'): World {
  const state: WorldState = {
    tick: 0,
    dot: { x: 0, y: 0 },
  };

  return {
    state,
    step(input: InputFrame): SimEvent[] {
      state.tick += 1;
      state.dot.x = Number((state.dot.x + input.moveX * 2).toFixed(4));
      state.dot.y = Number((state.dot.y + input.moveY * 2).toFixed(4));
      return [{ type: 'tick', tick: state.tick, x: state.dot.x, y: state.dot.y, data: { seed } }];
    },
    hash(): string {
      return stableStringify(state);
    },
  };
}
