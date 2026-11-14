export interface BossModule {
  id: string;
  exposesDuringPattern?: string;
}

export interface BossPattern {
  id: string;
  durationMs: number;
  telegraphMs: number;
  vulnerableWindowMs: number;
}

export interface BossSpec {
  generation: 1 | 2;
  modules: BossModule[];
  patterns: BossPattern[];
}

export interface BossValidationResult {
  ok: boolean;
  errors: string[];
}

function validateVulnerableWindows(spec: BossSpec, errors: string[]): void {
  for (const pattern of spec.patterns) {
    if (pattern.vulnerableWindowMs < 600) {
      errors.push(`Pattern ${pattern.id} vulnerableWindowMs < 600.`);
    }
  }
}

function validateTelegraphFloor(spec: BossSpec, errors: string[]): void {
  const floor = spec.generation === 1 ? 400 : 300;
  for (const pattern of spec.patterns) {
    if (pattern.telegraphMs < floor) {
      errors.push(`Pattern ${pattern.id} telegraphMs below ${floor}.`);
    }
  }
}

function validateTelegraphDensity(spec: BossSpec, errors: string[]): void {
  const totalDurationMs = spec.patterns.reduce((sum, pattern) => sum + pattern.durationMs, 0);
  const telegraphMs = spec.patterns.reduce((sum, pattern) => sum + pattern.telegraphMs, 0);
  const densityPer10s = totalDurationMs > 0 ? (telegraphMs / totalDurationMs) * 10000 : 0;
  if (densityPer10s < 4000) {
    errors.push('Total telegraph time per 10s is below 4s.');
  }
}

function validateRecoveryGap(spec: BossSpec, errors: string[]): void {
  for (const pattern of spec.patterns) {
    const recoveryMs = pattern.durationMs - pattern.telegraphMs - pattern.vulnerableWindowMs;
    if (recoveryMs < 250) {
      errors.push(`Pattern ${pattern.id} recovery gap below 250ms.`);
    }
  }
}

function validateModuleTargetability(spec: BossSpec, errors: string[]): void {
  const totalDurationMs = spec.patterns.reduce((sum, pattern) => sum + pattern.durationMs, 0);
  const windowMs = 3000;
  const intervalMs = 500;

  for (let windowStart = 0; windowStart < totalDurationMs; windowStart += intervalMs) {
    const windowEnd = windowStart + windowMs;
    let offset = 0;
    let targetable = false;

    for (const pattern of spec.patterns) {
      const start = offset;
      const end = offset + pattern.durationMs;
      const overlaps = start < windowEnd && end > windowStart;
      if (overlaps) {
        const hasExposedModule = spec.modules.some(
          (module) => module.exposesDuringPattern === undefined || module.exposesDuringPattern === pattern.id,
        );
        if (hasExposedModule) {
          targetable = true;
          break;
        }
      }
      offset = end;
    }

    if (!targetable) {
      errors.push(`No targetable module in 3s window starting at ${windowStart}ms.`);
      return;
    }
  }
}

export function validateBossArc(spec: BossSpec): BossValidationResult {
  const errors: string[] = [];
  validateVulnerableWindows(spec, errors);
  validateTelegraphFloor(spec, errors);
  validateTelegraphDensity(spec, errors);
  validateRecoveryGap(spec, errors);
  validateModuleTargetability(spec, errors);
  return { ok: errors.length === 0, errors };
}
