import { describe, expect, it } from 'vitest';
import { BUILD_INFO, formatBuildLabel } from '../../src/build-info';

describe('build metadata', () => {
  it('formats version, commit, and CI build number for display', () => {
    expect(
      formatBuildLabel({
        version: '1.2.3',
        commit: 'abcdef123456',
        buildNumber: '42',
        builtAt: '2026-11-14T00:00:00.000Z',
      }),
    ).toBe('v1.2.3 · abcdef12 · ci.42');
  });

  it('omits local build details while retaining the version', () => {
    expect(
      formatBuildLabel({
        version: '1.2.3',
        commit: 'unknown',
        buildNumber: 'local',
        builtAt: 'unknown',
      }),
    ).toBe('v1.2.3');
  });

  it('provides a usable build label in local/test environments', () => {
    expect(formatBuildLabel(BUILD_INFO)).toMatch(/^v.+/);
  });
});
