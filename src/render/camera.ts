export interface CameraState {
  x: number;
  y: number;
  trauma: number;
  reducedMotion: boolean;
}

export function createCameraState(): CameraState {
  return {
    x: 0,
    y: 0,
    trauma: 0,
    reducedMotion: false,
  };
}

export function addTrauma(state: CameraState, amount: number): CameraState {
  return {
    ...state,
    trauma: Math.min(1, state.trauma + amount),
  };
}

export function stepCamera(state: CameraState, dtMs: number, tick: number): CameraState {
  const decay = 1.6 * (dtMs / 1000);
  const trauma = Math.max(0, state.trauma - decay);
  if (state.reducedMotion || trauma <= 0) {
    return {
      ...state,
      x: 0,
      y: 0,
      trauma,
    };
  }

  const intensity = trauma * trauma;
  const x = Math.sin(tick * 0.41) * 6 * intensity;
  const y = Math.cos(tick * 0.37) * 6 * intensity;
  return {
    ...state,
    trauma,
    x: Math.max(-10, Math.min(10, x)),
    y: Math.max(-10, Math.min(10, y)),
  };
}
