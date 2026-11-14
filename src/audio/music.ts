export const MUSIC_BPM = 120;
export const MUSIC_TICKS_PER_EIGHTH = 15;
export const MUSIC_STEPS_PER_BAR = 8;

export interface MusicStepSpec {
  stepIndex: number;
  barIndex: number;
  stepInBar: number;
  kick: boolean;
  snare: boolean;
  hat: boolean;
  bassFrequency: number | null;
  leadFrequency: number | null;
}

const BASS_ROOTS = [55, 55, 65.406, 49];
const BOSS_LEAD = [220, 261.63, 293.66, 329.63];

/**
 * Quantizes the fixed 60 Hz simulation tick to an eighth-note grid. At
 * 120 BPM a beat is 30 ticks and an eighth note is 15 ticks.
 */
export function musicStepForTick(tick: number, bossActive: boolean): MusicStepSpec {
  const safeTick = Math.max(0, Math.floor(tick));
  const stepIndex = Math.floor(safeTick / MUSIC_TICKS_PER_EIGHTH);
  const stepInBar = ((stepIndex % MUSIC_STEPS_PER_BAR) + MUSIC_STEPS_PER_BAR) % MUSIC_STEPS_PER_BAR;
  const barIndex = Math.floor(stepIndex / MUSIC_STEPS_PER_BAR);
  const kick = stepInBar % 2 === 0;
  const snare = stepInBar === 2 || stepInBar === 6;
  const bassFrequency = kick || bossActive ? BASS_ROOTS[barIndex % BASS_ROOTS.length] : null;
  const leadFrequency =
    bossActive && stepInBar % 2 === 1
      ? BOSS_LEAD[(barIndex * 2 + stepInBar) % BOSS_LEAD.length]
      : null;

  return {
    stepIndex,
    barIndex,
    stepInBar,
    kick,
    snare,
    hat: true,
    bassFrequency,
    leadFrequency,
  };
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

  update(tick: number, bossActive: boolean, paused: boolean): void {
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

      this.scheduleStep(musicStepForTick(nextTick, bossActive), audioTime, bossActive);
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
