import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

export function main() {
  const root = process.cwd();
  const status = readJson(join(root, 'status.json'));
  const now = new Date().toISOString();

  const workstreams = (status.workstreams ?? {}) as Record<string, { status: string; gate: string; notes: string }>;
  const completed = Object.entries(workstreams).filter(([, value]) => value.status === 'done');
  const inProgress = Object.entries(workstreams).filter(([, value]) => value.status === 'in_progress');

  const report = [
    '# BUILD REPORT',
    '',
    `Generated: ${now}`,
    '',
    '## Scope status',
    '',
    `- Completed workstreams: ${completed.map(([id]) => id).join(', ') || 'none'}`,
    `- In-progress workstreams: ${inProgress.map(([id]) => id).join(', ') || 'none'}`,
    '',
    '## S1-S6 provisional status',
    '',
    '- S1 Frame time: **pending full 900-entity soak** (smoke soak in place).',
    '- S2 Restart latency: **pending e2e timer harness**.',
    '- S3 Determinism: **pass on replay checks** (`sim:replay`).',
    '- S4 On-ramp: **pending playtest telemetry cohort**.',
    '- S5 Readability: **partial via hue/invariant tests; pending playtest survey**.',
    '- S6 Content duration: **pending telemetry aggregation on full run loop**.',
    '',
    '## Notes',
    '',
    '- This report is generated from current implementation state and is expected to evolve as W2-W9 complete.',
  ].join('\n');

  writeFileSync(join(root, 'docs', 'BUILD_REPORT.md'), `${report}\n`, 'utf8');
  console.log(JSON.stringify({ output: join(root, 'docs', 'BUILD_REPORT.md') }, null, 2));
}

main();
