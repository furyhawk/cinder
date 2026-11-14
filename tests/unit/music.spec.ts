import { describe, expect, it } from 'vitest';
import {
  MUSIC_BPM,
  MUSIC_TICKS_PER_EIGHTH,
  musicStepForTick,
} from '../../src/audio/music';

describe('tempo-synchronized music', () => {
  it('uses a 120 BPM/eighth-note grid aligned to 60 Hz simulation ticks', () => {
    expect(MUSIC_BPM).toBe(120);
    expect(MUSIC_TICKS_PER_EIGHTH).toBe(15);
    expect(musicStepForTick(0, false)).toMatchObject({
      stepIndex: 0,
      stepInBar: 0,
      kick: true,
      snare: false,
      hat: true,
    });
    expect(musicStepForTick(15, false)).toMatchObject({
      stepIndex: 1,
      stepInBar: 1,
      kick: false,
      snare: false,
    });
  });

  it('places snares on beats two and four and resets per bar', () => {
    expect(musicStepForTick(30, false).snare).toBe(true);
    expect(musicStepForTick(90, false).snare).toBe(true);
    expect(musicStepForTick(120, false)).toMatchObject({
      barIndex: 1,
      stepInBar: 0,
      kick: true,
    });
  });

  it('adds an off-beat boss lead layer without breaking the beat grid', () => {
    const normal = musicStepForTick(15, false);
    const boss = musicStepForTick(15, true);
    expect(normal.leadFrequency).toBeNull();
    expect(boss.leadFrequency).not.toBeNull();
    expect(boss.stepIndex).toBe(normal.stepIndex);
    expect(musicStepForTick(15, true)).toEqual(boss);
  });

  it('varies the wave arrangement as the run progresses', () => {
    const firstWave = musicStepForTick(15, false, 1);
    const secondWave = musicStepForTick(15, false, 2);
    const fourthWave = musicStepForTick(15, false, 4);

    expect(firstWave.section).toBe('wave');
    expect(firstWave.arpFrequency).toBeNull();
    expect(secondWave.arpFrequency).not.toBeNull();
    expect(secondWave.arpFrequency).not.toBe(firstWave.arpFrequency);
    expect(fourthWave.arpFrequency).not.toBe(secondWave.arpFrequency);
    expect(secondWave.variation).not.toBe(firstWave.variation);
    expect(musicStepForTick(15, false, 2)).toEqual(secondWave);

    expect(musicStepForTick(45, false, 1).kick).toBe(false);
    expect(musicStepForTick(45, false, 2).kick).toBe(true);
  });

  it('uses a distinct boss progression and lead phrase', () => {
    const wave = musicStepForTick(15, false, 2);
    const bossOne = musicStepForTick(15, true, 1);
    const bossTwo = musicStepForTick(15, true, 2);

    expect(wave.section).toBe('wave');
    expect(bossOne.section).toBe('boss');
    expect(bossOne.leadFrequency).not.toBeNull();
    expect(bossOne.arpFrequency).toBeNull();
    expect(bossOne.bassFrequency).toBe(55);
    expect(bossTwo.bassFrequency).toBe(49);
    expect(bossTwo.leadFrequency).not.toBe(bossOne.leadFrequency);
  });
});
