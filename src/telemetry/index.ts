import type { SimEvent, WorldState } from '../sim/world';

export type CauseKind = 'projectile' | 'contact' | 'arena' | 'boss_pattern' | 'self';

export interface TelemetryRecord {
  event: string;
  t: number;
  runId: string;
  buildHash: string;
  [key: string]: string | number | string[] | number[] | undefined;
}

function safeStringify(record: TelemetryRecord): string {
  return JSON.stringify(record);
}

function nowIso(): string {
  return new Date().toISOString();
}

export class TelemetrySession {
  private readonly runId: string;
  private readonly buildHash: string;
  private readonly startedAt = performance.now();
  private readonly records: TelemetryRecord[] = [];

  constructor(runId: string, buildHash: string) {
    this.runId = runId;
    this.buildHash = buildHash;
  }

  emit(event: string, payload: Omit<TelemetryRecord, 'event' | 't' | 'runId' | 'buildHash'> = {}): void {
    const record: TelemetryRecord = {
      event,
      t: Math.floor(performance.now() - this.startedAt),
      runId: this.runId,
      buildHash: this.buildHash,
      ...payload,
    };
    this.records.push(record);
  }

  emitRunStart(world: WorldState): void {
    this.emit('run_start', {
      difficulty: world.difficulty,
      deck: world.player.deck,
      seed: world.seed,
    });
  }

  emitRunEnd(world: WorldState, outcome: 'victory' | 'defeat'): void {
    this.emit('run_end', {
      outcome,
      durationMs: world.tick * (1000 / 60),
      bossKills: outcome === 'victory' ? 1 : 0,
    });
  }

  emitRestart(deathToInputMs: number): void {
    this.emit('restart', {
      deathToInputMs,
    });
  }

  emitSimEvents(world: WorldState, events: SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'player_hit') {
        // A player_hit event is emitted for every damage instance. Only record
        // a death record when the post-hit HP confirms the hit was lethal.
        const hpAtHit = Number(event.data?.hp ?? world.player.hp);
        if (Number.isFinite(hpAtHit) && hpAtHit <= 0) {
          const kind = (event.data?.source as CauseKind | undefined) ?? 'projectile';
          this.emit('player_death', {
            waveId: `wave_${String(world.wave).padStart(2, '0')}`,
            causeEntity: String(event.data?.kind ?? 'unknown'),
            causeKind: kind,
            hpAtDeath: hpAtHit,
            surgesAvailable: world.player.surgeCooldown <= 0 ? 1 : 0,
          });
        }
      }

      if (event.type === 'wave_break') {
        this.emit('wave_break', {
          phase: String(event.data?.phase ?? 'started'),
          durationMs: Number(event.data?.durationMs ?? 0),
          nextWave: Number(event.data?.nextWave ?? world.wave),
        });
      }

      if (event.type === 'boss_warning') {
        this.emit('boss_warning', {
          phase: String(event.data?.phase ?? 'warning'),
          durationMs: Number(event.data?.durationMs ?? 0),
          generation: Number(event.data?.generation ?? 1),
        });
      }

      if (event.type === 'boss_phase') {
        this.emit('boss_phase', {
          phase: Number(event.data?.phase ?? 1),
          hpFraction: Number(event.data?.hpFraction ?? 1),
          attemptIndex: 1,
        });
      }

      if (event.type === 'upgrade_offered') {
        this.emit('upgrade_offered', {
          axisCount: Number(event.data?.count ?? 0),
          cost: Number(event.data?.cost ?? 0),
        });
      }

      if (event.type === 'card_offered') {
        this.emit('card_offered', {
          deckIds: [world.player.deck],
          takenId: '',
        });
      }

      if (event.type === 'powerup_collected') {
        this.emit('powerup_collected', {
          powerUp: String(event.data?.powerUp ?? 'unknown'),
          waveId: `wave_${String(world.wave).padStart(2, '0')}`,
        });
      }
    }
  }

  exportNdjson(): string {
    return this.records.map((record) => safeStringify(record)).join('\n');
  }

  flushToConsoleSummary(): void {
    const summary = {
      emittedAt: nowIso(),
      runId: this.runId,
      buildHash: this.buildHash,
      eventCount: this.records.length,
    };
    console.info('[telemetry]', summary);
  }
}
