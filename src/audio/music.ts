export const MUSIC_BPM = 120;
export const MUSIC_TICKS_PER_EIGHTH = 15;
export const MUSIC_STEPS_PER_BAR = 8;

export type MusicSection = 'wave' | 'boss';

export interface MusicStepSpec {
  stepIndex: number;
  barIndex: number;
  stepInBar: number;
  section: MusicSection;
  variation: number;
  kick: boolean;
  snare: boolean;
  hat: boolean;
  bassFrequency: number | null;
  leadFrequency: number | null;
  arpFrequency: number | null;
}

const WAVE_BASS_ROOTS = [
  [55, 55, 65.406, 49],
  [49, 55, 65.406, 73.416],
  [65.406, 73.416, 82.407, 61.735],
  [55, 82.407, 73.416, 65.406],
];

const BOSS_BASS_ROOTS = [
  [55, 55, 49, 65.406],
  [49, 61.735, 55, 73.416],
  [65.406, 65.406, 55, 49],
];

const BOSS_LEAD_PATTERNS = [
  [220, 261.63, 293.66, 329.63],
  [196, 246.94, 293.66, 349.23],
  [174.61, 220, 261.63, 311.13],
];

const WAVE_ARP_NOTES = [220, 261.63, 293.66, 329.63, 392, 329.63, 293.66, 261.63];

function normalizedWave(wave: number): number {
  return Math.max(1, Math.floor(Number.isFinite(wave) ? wave : 1));
}

/**
 * Quantizes the fixed 60 Hz simulation tick to an eighth-note grid. At
 * 120 BPM a beat is 30 ticks and an eighth note is 15 ticks.
 */
export function musicStepForTick(
  tick: number,
  bossActive: boolean,
  wave = 1,
): MusicStepSpec {
  const safeTick = Math.max(0, Math.floor(tick));
  const stepIndex = Math.floor(safeTick / MUSIC_TICKS_PER_EIGHTH);
  const stepInBar = ((stepIndex % MUSIC_STEPS_PER_BAR) + MUSIC_STEPS_PER_BAR) % MUSIC_STEPS_PER_BAR;
  const barIndex = Math.floor(stepIndex / MUSIC_STEPS_PER_BAR);
  const section: MusicSection = bossActive ? 'boss' : 'wave';
  const waveNumber = normalizedWave(wave);
  const variation = bossActive
    ? (waveNumber - 1) % BOSS_LEAD_PATTERNS.length
    : (waveNumber - 1) % WAVE_BASS_ROOTS.length;

  let kick = stepInBar % 2 === 0;
  let snare = stepInBar === 2 || stepInBar === 6;

  if (chapterVariationIsActive(section, variation)) {
    kick ||= stepInBar === 3 || stepInBar === 7;
    snare ||= stepInBar === 4;
  }

  const bassRoots = bossActive
    ? BOSS_BASS_ROOTS[variation % BOSS_BASS_ROOTS.length]
    : WAVE_BASS_ROOTS[variation % WAVE_BASS_ROOTS.length];
  const bassFrequency =
    kick || bossActive ? bassRoots[barIndex % bassRoots.length] : null;

  const leadFrequency =
    bossActive && stepInBar % 2 === 1
      ? BOSS_LEAD_PATTERNS[variation % BOSS_LEAD_PATTERNS.length][
          (barIndex * 2 + stepInBar) % BOSS_LEAD_PATTERNS[0].length
        ]
      : null;

  const arpFrequency =
    !bossActive && variation > 0 && stepInBar % 2 === 1
      ? WAVE_ARP_NOTES[(barIndex * 2 + stepInBar + variation) % WAVE_ARP_NOTES.length]
      : null;

  return {
    stepIndex,
    barIndex,
    stepInBar,
    section,
    variation,
    kick,
    snare,
    hat: true,
    bassFrequency,
    leadFrequency,
    arpFrequency,
  };
}

function chapterVariationIsActive(section: MusicSection, variation: number): boolean {
  return section === 'boss' || variation > 0;
}

export class MusicEngine {
  private scheduledThroughTick = -1;
  private anchorTick = 0;
  private anchorContextTime = 0;
  private started = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(
    private readonly context: AudioContext,
    private readonly destination: AudioNode,
  ) {}

  update(tick: number, bossActive: boolean, paused: boolean, wave = 1): void {
    if (paused) {
      this.started = false;
      return;
    }

    const now = this.context.currentTime;
    if (!this.started || tick < this.anchorTick) {
      this.started = true;
      this.anchorTick = tick;
      this.anchorContextTime = now;
      this.scheduledThroughTick =
        Math.floor(tick / MUSIC_TICKS_PER_EIGHTH) * MUSIC_TICKS_PER_EIGHTH - 1;
    }

    const lookaheadTicks = 18;
    let nextTick =
      Math.floor(tick / MUSIC_TICKS_PER_EIGHTH) * MUSIC_TICKS_PER_EIGHTH;
    if (nextTick <= this.scheduledThroughTick) {
      nextTick =
        (Math.floor(this.scheduledThroughTick / MUSIC_TICKS_PER_EIGHTH) + 1) *
        MUSIC_TICKS_PER_EIGHTH;
    }

    while (nextTick <= tick + lookaheadTicks) {
      const audioTime = this.anchorContextTime + (nextTick - this.anchorTick) / 60;
      if (audioTime < now - 0.05) {
        // The game was paused or the tab stalled; restart the music grid from
        // the current simulation tick instead of scheduling notes in the past.
        this.anchorTick = tick;
        this.anchorContextTime = now;
        this.scheduledThroughTick =
          Math.floor(tick / MUSIC_TICKS_PER_EIGHTH) * MUSIC_TICKS_PER_EIGHTH - 1;
        return;
      }

      this.scheduleStep(musicStepForTick(nextTick, bossActive, wave), audioTime, bossActive);
      this.scheduledThroughTick = nextTick;
      nextTick += MUSIC_TICKS_PER_EIGHTH;
    }
  }

  private scheduleStep(step: MusicStepSpec, at: number, bossActive: boolean): void {
    if (step.kick) this.kick(at, bossActive ? 0.2 : 0.16);
    if (step.snare) this.snare(at, bossActive ? 0.085 : 0.065);
    if (step.hat) this.hat(at, step.stepInBar % 2 === 1 ? 0.018 : 0.028);
    if (step.bassFrequency !== null) {
      this.bass(at, step.bassFrequency, bossActive ? 0.085 : 0.065);
    }
    if (step.leadFrequency !== null) {
      this.lead(at, step.leadFrequency, 0.025);
    }
    if (step.arpFrequency !== null) {
      this.arp(at, step.arpFrequency, 0.018 + step.variation * 0.002);
    }
  }

  private kick(at: number, gain: number): void {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(150, at);
    oscillator.frequency.exponentialRampToValueAtTime(42, at + 0.17);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.19);
    oscillator.connect(envelope);
    envelope.connect(this.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.21);
  }

  private snare(at: number, gain: number): void {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = this.getNoiseBuffer();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1400, at);
    envelope.gain.setValueAtTime(gain, at);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.destination);
    source.start(at);
    source.stop(at + 0.14);
  }

  private hat(at: number, gain: number): void {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = this.getNoiseBuffer();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7200, at);
    envelope.gain.setValueAtTime(gain, at);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.destination);
    source.start(at);
    source.stop(at + 0.05);
  }

  private bass(at: number, frequency: number, gain: number): void {
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, at);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, at);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.22);
  }

  private lead(at: number, frequency: number, gain: number): void {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, at);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    oscillator.connect(envelope);
    envelope.connect(this.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.11);
  }

  private arp(at: number, frequency: number, gain: number): void {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, at);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.075);
    oscillator.connect(envelope);
    envelope.connect(this.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.09);
  }

  private getNoiseBuffer(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(this.context.sampleRate * 0.25);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x9e3779b9;
    for (let index = 0; index < length; index += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[index] = (seed / 0xffffffff) * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }
}
