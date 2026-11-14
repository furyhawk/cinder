import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

interface PackageJson {
  version: string;
}

function readGitCommit(): string {
  try {
    const commit = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
    return dirty.length > 0 ? `${commit}-dirty` : commit;
  } catch {
    return 'unknown';
  }
}

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as PackageJson;
const buildInfo = {
  version: packageJson.version,
  commit: process.env.GITHUB_SHA?.slice(0, 8) ?? readGitCommit(),
  buildNumber: process.env.GITHUB_RUN_NUMBER ?? 'local',
  builtAt: process.env.BUILD_TIME ?? new Date().toISOString(),
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildInfo.version),
    __BUILD_COMMIT__: JSON.stringify(buildInfo.commit),
    __BUILD_NUMBER__: JSON.stringify(buildInfo.buildNumber),
    __BUILD_TIME__: JSON.stringify(buildInfo.builtAt),
  },
  plugins: [
    {
      name: 'cinder-build-info',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'build-info.json',
          source: `${JSON.stringify(buildInfo, null, 2)}\n`,
        });
      },
    },
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
});
