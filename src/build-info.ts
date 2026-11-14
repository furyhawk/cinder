export interface BuildInfo {
  version: string;
  commit: string;
  buildNumber: string;
  builtAt: string;
}

const FALLBACK_BUILD_INFO: BuildInfo = {
  version: 'dev',
  commit: 'local',
  buildNumber: 'local',
  builtAt: 'unknown',
};

function readInjectedBuildInfo(): BuildInfo {
  return {
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : FALLBACK_BUILD_INFO.version,
    commit: typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : FALLBACK_BUILD_INFO.commit,
    buildNumber:
      typeof __BUILD_NUMBER__ === 'string' ? __BUILD_NUMBER__ : FALLBACK_BUILD_INFO.buildNumber,
    builtAt: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : FALLBACK_BUILD_INFO.builtAt,
  };
}

export const BUILD_INFO: BuildInfo = Object.freeze(readInjectedBuildInfo());

export function formatBuildLabel(info: BuildInfo = BUILD_INFO): string {
  const parts = [`v${info.version}`];
  if (info.commit && info.commit !== 'unknown') {
    parts.push(info.commit.slice(0, 8));
  }
  if (info.buildNumber && info.buildNumber !== 'local') {
    parts.push(`ci.${info.buildNumber}`);
  }
  return parts.join(' · ');
}
