export interface RunIdDependencies {
  /** Injected UUID source; pass null to force the fallback path in tests. */
  randomUUID?: (() => string) | null;
  /** Fallback clock and entropy sources used outside secure contexts. */
  now?: () => number;
  random?: () => number;
}

function getSecureRandomUuid(): (() => string) | undefined {
  const cryptoApi = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;
  if (!cryptoApi || typeof cryptoApi.randomUUID !== 'function') {
    return undefined;
  }
  return () => cryptoApi.randomUUID!();
}

/**
 * Creates a telemetry run ID without assuming a secure browser context.
 * `crypto.randomUUID` is unavailable on plain-HTTP LAN origins, so fall back
 * to timestamp plus entropy rather than aborting application startup.
 */
export function createRunId(dependencies: RunIdDependencies = {}): string {
  const uuid = dependencies.randomUUID === null ? undefined : dependencies.randomUUID ?? getSecureRandomUuid();
  if (uuid) {
    return `run-${uuid()}`;
  }

  const now = dependencies.now ?? Date.now;
  const random = dependencies.random ?? Math.random;
  const entropy = Math.floor(random() * 0x100000000)
    .toString(36)
    .padStart(7, '0');
  return `run-${now().toString(36)}-${entropy}`;
}
