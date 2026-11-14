import type { ArenaLayout } from './geometry';

export const foundryLayouts: ArenaLayout[] = [
  {
    id: 'foundry_ring',
    polygon: [
      [80, 80],
      [1200, 80],
      [1200, 640],
      [80, 640],
    ],
  },
  {
    id: 'foundry_cross',
    polygon: [
      [120, 120],
      [560, 120],
      [560, 80],
      [720, 80],
      [720, 120],
      [1160, 120],
      [1160, 600],
      [720, 600],
      [720, 640],
      [560, 640],
      [560, 600],
      [120, 600],
    ],
  },
  {
    id: 'foundry_pit',
    polygon: [
      [100, 100],
      [1180, 100],
      [1180, 620],
      [100, 620],
    ],
  },
];
