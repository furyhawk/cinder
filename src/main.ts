import './style.css';
import {
  BOSS_SPAWN_X,
  BOSS_SPAWN_Y,
  createInputFrame,
  createWorld,
  ENEMY_SPAWN_WARNING_MS,
  UPGRADE_AXES,
  UPGRADE_AXIS_DEFINITIONS,
  upgradeAxisCost,
  type UpgradeAxis,
} from './sim/world';
import { createFixedStepLoopState, updateFixedStepLoop } from './sim/loop';
import { TelemetrySession } from './telemetry';
import { createRunId } from './telemetry/run-id';
import { addTrauma, createCameraState, stepCamera } from './render/camera';
import { computeTelegraphCue } from './render/telegraph';
import { ParticlePool } from './render/particles';
import { cameraTraumaForSimEvent, particlesForSimEvent } from './render/effects';
import { foundryLayouts } from './sim/arena/layouts';
import {
  UPGRADE_AXIS_LAYOUT,
  aimVectorFromPlayerToPointer,
  canvasPointFromClient,
  upgradeAxisIndexAt,
} from './ui/pointer';
import { EMPTY_GAMEPAD_INPUT, mapGamepad, type GamepadInput } from './ui/gamepad';
import {
  createTitleScreenState,
  isTitleStartGamepadInput,
  isTitleStartKey,
  startGameFromTitle,
} from './ui/title-screen';
import { AudioEngine } from './audio/sfx';
import { soundForSimEvent } from './audio/event-map';
import { MUSIC_BPM } from './audio/music';
import { powerUpDefinition } from './sim/powerups';
import { BUILD_INFO, formatBuildLabel } from './build-info';
import {
  ENEMY_COLORS,
  NEON,
  POWER_UP_COLORS,
  PROJECTILE_COLORS,
  withAlpha,
} from './render/theme';

const canvas = document.createElement('canvas');
canvas.width = 1280;
canvas.height = 720;
const rawContext = canvas.getContext('2d');
if (!rawContext) {
  throw new Error('Unable to create 2D context for canvas.');
}
const context: CanvasRenderingContext2D = rawContext;

document.body.appendChild(canvas);

const rootStyle = document.documentElement.style;
rootStyle.setProperty('--cinder-void', NEON.void);
rootStyle.setProperty('--cinder-phosphor', NEON.phosphor);
rootStyle.setProperty('--cinder-cyan', NEON.cyan);
rootStyle.setProperty('--cinder-purple', NEON.purple);
rootStyle.setProperty('--cinder-pink', NEON.pink);
rootStyle.setProperty('--cinder-amber', NEON.amber);

const world = createWorld('cinder', 'normal');
const telemetry = new TelemetrySession(createRunId(), BUILD_INFO.commit);
const audio = new AudioEngine();

const pressed = {
  w: false,
  a: false,
  s: false,
  d: false,
};

const mouse = {
  x: 640,
  y: 360,
  down: false,
};

const state = {
  screen: createTitleScreenState(),
  loop: createFixedStepLoopState(),
  queuedSurge: false,
  gamepadSurgeQueued: false,
  gamepad: EMPTY_GAMEPAD_INPUT,
  lastWave: world.state.wave,
  endedAtMs: 0,
  hitStopMs: 0,
  camera: createCameraState(),
  particles: new ParticlePool(1800),
  damageFlashMs: 0,
  powerUpFlashMs: 0,
  upgradeSelection: 0,
};

if (new URLSearchParams(window.location.search).has('debug')) {
  (
    window as typeof window & {
      __cinderDebug?: {
        world: typeof world;
        runtime: typeof state;
        mouse: typeof mouse;
        audio: typeof audio;
      };
    }
  ).__cinderDebug = { world, runtime: state, mouse, audio };
}

function clampInput(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function readGamepadInput(): GamepadInput {
  const gamepads = navigator.getGamepads?.() ?? [];
  const active = Array.from(gamepads).find(
    (candidate): candidate is Gamepad => candidate !== null && candidate.connected,
  );
  return mapGamepad(active);
}

function getInput(tick: number): ReturnType<typeof createInputFrame> {
  const keyboardMoveX = (pressed.d ? 1 : 0) - (pressed.a ? 1 : 0);
  const keyboardMoveY = (pressed.s ? 1 : 0) - (pressed.w ? 1 : 0);
  const player = world.state.player;
  const aim = state.gamepad.hasAim
    ? { x: state.gamepad.aimX, y: state.gamepad.aimY }
    : aimVectorFromPlayerToPointer(
        { x: player.x, y: player.y },
        { x: mouse.x, y: mouse.y },
      );

  return createInputFrame(tick, {
    moveX: clampInput(keyboardMoveX + state.gamepad.moveX),
    moveY: clampInput(keyboardMoveY + state.gamepad.moveY),
    aimX: aim.x,
    aimY: aim.y,
    fire: mouse.down || state.gamepad.fire,
    surge: state.queuedSurge || state.gamepadSurgeQueued,
  });
}

let arenaBackgroundGradient: CanvasGradient | null = null;
let titleBackgroundGradient: CanvasGradient | null = null;
let crtOverlayCanvas: HTMLCanvasElement | null = null;

function getArenaBackgroundGradient(): CanvasGradient {
  if (!arenaBackgroundGradient) {
    arenaBackgroundGradient = context.createRadialGradient(640, 340, 40, 640, 360, 780);
    arenaBackgroundGradient.addColorStop(0, withAlpha(NEON.cyan, 0.12));
    arenaBackgroundGradient.addColorStop(0.32, '#091a2e');
    arenaBackgroundGradient.addColorStop(0.68, '#050d1a');
    arenaBackgroundGradient.addColorStop(1, NEON.void);
  }
  return arenaBackgroundGradient;
}

function getTitleBackgroundGradient(): CanvasGradient {
  if (!titleBackgroundGradient) {
    titleBackgroundGradient = context.createRadialGradient(640, 308, 20, 640, 360, 760);
    titleBackgroundGradient.addColorStop(0, withAlpha(NEON.purple, 0.22));
    titleBackgroundGradient.addColorStop(0.34, '#0b1a31');
    titleBackgroundGradient.addColorStop(0.7, NEON.phosphor);
    titleBackgroundGradient.addColorStop(1, NEON.void);
  }
  return titleBackgroundGradient;
}

function getCrtOverlayCanvas(): HTMLCanvasElement {
  if (crtOverlayCanvas) return crtOverlayCanvas;

  crtOverlayCanvas = document.createElement('canvas');
  crtOverlayCanvas.width = canvas.width;
  crtOverlayCanvas.height = canvas.height;
  const overlayContext = crtOverlayCanvas.getContext('2d');
  if (!overlayContext) return crtOverlayCanvas;

  // The mild always-on falloff stays outside the central readability zone.
  const vignette = overlayContext.createRadialGradient(640, 360, 210, 640, 360, 760);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.62, 'rgba(0, 0, 0, 0.06)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.44)');
  overlayContext.fillStyle = vignette;
  overlayContext.fillRect(0, 0, canvas.width, canvas.height);

  // Bake the scanlines into the same cached layer so the frame incurs one
  // full-screen blit instead of a gradient pass plus a repeated pattern fill.
  overlayContext.fillStyle = 'rgba(0, 0, 0, 0.13)';
  for (let y = 0; y < canvas.height; y += 4) {
    overlayContext.fillRect(0, y, canvas.width, 1);
  }
  return crtOverlayCanvas;
}

function tracePolygon(points: readonly (readonly [number, number])[]): void {
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

function drawArena() {
  // Layered backdrop: a broad phosphor bloom over a deep void gradient.
  context.fillStyle = NEON.void;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = getArenaBackgroundGradient();
  context.fillRect(0, 0, canvas.width, canvas.height);

  // The playfield itself is slightly darker than the ambient bloom so sprites
  // retain a strong silhouette against the grid.
  context.fillStyle = NEON.arena;
  context.fillRect(40, 40, 1200, 640);

  // Neon vector grid. Dim guidelines establish the space; brighter major
  // lines and the centre axes add depth without competing with actors.
  context.save();
  context.beginPath();
  context.rect(40, 40, 1200, 640);
  context.clip();

  context.strokeStyle = withAlpha(NEON.gridDim, 0.55);
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 40; x <= 1240; x += 40) {
    context.moveTo(x, 40);
    context.lineTo(x, 680);
  }
  for (let y = 40; y <= 680; y += 40) {
    context.moveTo(40, y);
    context.lineTo(1240, y);
  }
  context.stroke();

  context.strokeStyle = withAlpha(NEON.cyan, 0.12);
  context.lineWidth = 1.5;
  context.beginPath();
  for (let x = 80; x < 1240; x += 160) {
    context.moveTo(x, 40);
    context.lineTo(x, 680);
  }
  for (let y = 80; y < 680; y += 160) {
    context.moveTo(40, y);
    context.lineTo(1240, y);
  }
  context.stroke();

  context.strokeStyle = withAlpha(NEON.purple, 0.14);
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(640, 40);
  context.lineTo(640, 680);
  context.moveTo(40, 360);
  context.lineTo(1240, 360);
  context.stroke();
  context.restore();

  const current = foundryLayouts.find((layout) => layout.id === world.state.arena.currentLayoutId);
  if (current) {
    const layoutFill = context.createLinearGradient(0, 72, 0, 648);
    layoutFill.addColorStop(0, withAlpha(NEON.panelRaised, 0.86));
    layoutFill.addColorStop(0.52, withAlpha(NEON.panel, 0.9));
    layoutFill.addColorStop(1, withAlpha(NEON.arenaDeep, 0.94));

    context.save();
    context.beginPath();
    tracePolygon(current.polygon);
    context.fillStyle = layoutFill;
    context.fill();

    // Layered strokes emulate a soft vector glow without allocating a large
    // blurred shadow surface every frame.
    context.strokeStyle = withAlpha(NEON.purple, 0.12);
    context.lineWidth = 10;
    context.stroke();
    context.strokeStyle = withAlpha(NEON.purple, 0.38);
    context.lineWidth = 5;
    context.stroke();
    context.strokeStyle = withAlpha(NEON.purple, 0.82);
    context.lineWidth = 2.5;
    context.stroke();
    context.strokeStyle = withAlpha(NEON.cyan, 0.42);
    context.lineWidth = 1;
    context.stroke();

    context.fillStyle = withAlpha(NEON.cyanBright, 0.85);
    for (const [x, y] of current.polygon) {
      context.beginPath();
      context.arc(x, y, 2.2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  // Glowing outer frame with a crisp, bright inner edge. Multiple strokes are
  // cheaper than a large shadow pass and hold up at the fixed 1280x720 size.
  context.save();
  context.strokeStyle = withAlpha(NEON.cyan, 0.07);
  context.lineWidth = 18;
  context.strokeRect(40, 40, 1200, 640);
  context.strokeStyle = withAlpha(NEON.cyan, 0.2);
  context.lineWidth = 7;
  context.strokeRect(40, 40, 1200, 640);
  context.strokeStyle = withAlpha(NEON.cyan, 0.68);
  context.lineWidth = 2;
  context.strokeRect(40, 40, 1200, 640);
  context.strokeStyle = NEON.cyanBright;
  context.lineWidth = 1;
  context.strokeRect(45.5, 45.5, 1189, 629);

  context.strokeStyle = withAlpha(NEON.pink, 0.62);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(28, 72);
  context.lineTo(28, 28);
  context.lineTo(72, 28);
  context.moveTo(1208, 28);
  context.lineTo(1252, 28);
  context.lineTo(1252, 72);
  context.moveTo(1252, 648);
  context.lineTo(1252, 692);
  context.lineTo(1208, 692);
  context.moveTo(72, 692);
  context.lineTo(28, 692);
  context.lineTo(28, 648);
  context.stroke();
  context.restore();

  if (world.state.arena.nextLayoutId && world.state.arena.telegraphMsRemaining > 0) {
    const next = foundryLayouts.find((layout) => layout.id === world.state.arena.nextLayoutId);
    if (next) {
      const cue = computeTelegraphCue(world.state.arena.telegraphMsRemaining);
      context.save();

      // Cue 3: incoming footprint fill.
      context.globalAlpha = cue.hatchAlpha;
      context.fillStyle = NEON.amber;
      context.beginPath();
      tracePolygon(next.polygon);
      context.fill();

      // Cue 1: pulsing edge of the incoming shape.
      context.globalAlpha = cue.edgeAlpha;
      context.setLineDash([10, 8]);
      context.strokeStyle = NEON.amberBright;
      context.lineWidth = cue.edgeWidth;
      context.beginPath();
      tracePolygon(next.polygon);
      context.stroke();

      // Cue 2: expanding decal ring centred on the arena.
      context.setLineDash([]);
      context.globalAlpha = cue.decalAlpha;
      context.strokeStyle = NEON.pinkBright;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(640, 360, cue.decalRadius, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
  }
}

function drawPlayer() {
  const p = world.state.player;
  context.save();
  context.translate(p.x, p.y);

  context.shadowColor = withAlpha(NEON.cyan, 0.95);
  context.shadowBlur = 14;
  context.fillStyle = NEON.purpleBright;
  context.beginPath();
  context.arc(0, 0, p.radius, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;

  context.strokeStyle = NEON.cyanBright;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, p.radius, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = withAlpha(NEON.cyan, 0.86);
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(p.aimX * 28, p.aimY * 28);
  context.stroke();

  if (p.surgeTimer > 0) {
    context.globalAlpha = Math.min(1, p.surgeTimer / 140);
    context.shadowColor = withAlpha(NEON.cyanBright, 0.9);
    context.shadowBlur = 12;
    context.strokeStyle = NEON.cyanBright;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, p.radius + 9, 0, Math.PI * 2);
    context.stroke();
    context.shadowBlur = 0;
    context.globalAlpha = 1;
  }

  context.restore();
}

function drawProjectiles() {
  for (const projectile of world.state.projectiles) {
    if (projectile.owner === 'player' && projectile.kind === 'missile') {
      context.fillStyle = NEON.amber;
      context.save();
      context.translate(projectile.x, projectile.y);
      context.rotate(Math.atan2(projectile.vy, projectile.vx));
      context.beginPath();
      context.moveTo(projectile.radius + 4, 0);
      context.lineTo(-projectile.radius, projectile.radius);
      context.lineTo(-projectile.radius, -projectile.radius);
      context.closePath();
      context.fill();
      context.strokeStyle = withAlpha(NEON.amberBright, 0.88);
      context.lineWidth = 1;
      context.stroke();
      context.restore();
      continue;
    }

    context.fillStyle =
      projectile.owner === 'player' ? PROJECTILE_COLORS.player : PROJECTILE_COLORS.enemy;
    context.beginPath();
    context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    context.fill();
  }
}

function enemyColor(kind: string): string {
  return ENEMY_COLORS[kind] ?? NEON.red;
}

function drawEnemies() {
  for (const enemy of world.state.enemies) {
    const spawnWarningMs = enemy.spawnWarningMs ?? 0;
    const isSpawning = spawnWarningMs > 0;
    const warningProgress = isSpawning
      ? Math.min(1, Math.max(0, 1 - spawnWarningMs / ENEMY_SPAWN_WARNING_MS))
      : 1;

    if (isSpawning) {
      const pulse = 0.55 + 0.45 * Math.sin(warningProgress * Math.PI * 6);
      context.save();
      context.globalAlpha = 0.45 + 0.35 * pulse;
      context.strokeStyle = NEON.pink;
      context.lineWidth = 3;
      context.setLineDash([7, 5]);
      context.beginPath();
      context.arc(enemy.x, enemy.y, enemy.radius + 16, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      context.restore();
    }

    context.save();
    context.globalAlpha = isSpawning ? 0.25 + warningProgress * 0.55 : 1;
    context.fillStyle = enemyColor(enemy.kind);
    context.strokeStyle = withAlpha(NEON.amberBright, 0.85);
    context.lineWidth = 2;

    if (enemy.kind === 'bomber') {
      context.beginPath();
      context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.strokeStyle = NEON.amberBright;
      context.beginPath();
      context.arc(enemy.x, enemy.y, enemy.radius * 0.58, 0, Math.PI * 2);
      context.stroke();
    } else if (enemy.kind === 'weaver') {
      context.save();
      context.translate(enemy.x, enemy.y);
      context.rotate(Math.PI / 4);
      context.fillRect(-enemy.radius * 0.7, -enemy.radius * 0.7, enemy.radius * 1.4, enemy.radius * 1.4);
      context.strokeRect(-enemy.radius * 0.7, -enemy.radius * 0.7, enemy.radius * 1.4, enemy.radius * 1.4);
      context.restore();
    } else {
      context.beginPath();
      context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    context.restore();

    if (isSpawning) {
      context.save();
      context.fillStyle = NEON.pinkBright;
      context.font = 'bold 18px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('!', enemy.x, enemy.y);
      context.restore();
      continue;
    }

    context.fillStyle = withAlpha(NEON.textMuted, 0.7);
    context.fillRect(enemy.x - 18, enemy.y - enemy.radius - 12, 36, 4);
    context.fillStyle = NEON.green;
    context.fillRect(enemy.x - 18, enemy.y - enemy.radius - 12, (enemy.hp / enemy.maxHp) * 36, 4);
  }
}

function drawBossWarning() {
  const remainingMs = world.state.bossWarningMs;
  if (remainingMs <= 0 || world.state.boss) return;

  const totalMs = Math.max(1, world.state.bossWarningTotalMs);
  const progress = Math.max(0, Math.min(1, 1 - remainingMs / totalMs));
  const pulse = 0.55 + Math.sin(world.state.tick * 0.2) * 0.25;

  context.save();
  context.translate(BOSS_SPAWN_X, BOSS_SPAWN_Y);

  // Arena-space arrival marker: three concentric warning rings plus rotating
  // crosshairs ensure the announcement is readable without relying on HUD text.
  context.globalAlpha = 0.12 + progress * 0.12;
  context.fillStyle = NEON.red;
  context.beginPath();
  context.arc(0, 0, 150, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  for (let ring = 0; ring < 3; ring += 1) {
    const radius = 48 + ring * 30 + progress * 18;
    context.globalAlpha = Math.max(0.12, pulse - ring * 0.12);
    context.strokeStyle = ring === 1 ? NEON.amber : NEON.red;
    context.lineWidth = ring === 0 ? 4 : 2;
    context.setLineDash(ring === 1 ? [10, 8] : []);
    context.beginPath();
    context.arc(0, 0, radius, world.state.tick * 0.02 + ring, Math.PI * 2 + world.state.tick * 0.02 + ring);
    context.stroke();
  }
  context.setLineDash([]);
  context.globalAlpha = 1;

  context.strokeStyle = NEON.pinkBright;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-18, 0);
  context.lineTo(18, 0);
  context.moveTo(0, -18);
  context.lineTo(0, 18);
  context.stroke();

  context.fillStyle = NEON.white;
  context.font = 'bold 22px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('!', 0, 1);
  context.restore();
}

function drawWaveBreakHud() {
  const miniBreakMs = world.state.miniWaveBreakMs ?? null;
  const breakMs = world.state.waveBreakMs;
  const isMiniBreak = miniBreakMs !== null && miniBreakMs > 0;
  if (!isMiniBreak && (breakMs === null || breakMs <= 0)) return;

  const remainingMs = isMiniBreak ? miniBreakMs : breakMs!;
  const totalMs = Math.max(
    1,
    isMiniBreak ? world.state.miniWaveBreakTotalMs ?? 1 : world.state.waveBreakTotalMs,
  );
  const progress = Math.max(0, Math.min(1, 1 - remainingMs / totalMs));
  const width = 340;
  const x = (canvas.width - width) / 2;
  const y = 104;
  const activeWave = world.state.activeWave ?? world.state.wave;
  const miniWave = world.state.miniWave ?? 0;
  const miniWaveTotal = world.state.miniWaveTotal ?? 0;

  context.save();
  context.fillStyle = withAlpha(NEON.phosphor, 0.9);
  context.fillRect(x, y, width, 48);
  context.strokeStyle = isMiniBreak ? NEON.purple : NEON.green;
  context.lineWidth = 1;
  context.strokeRect(x, y, width, 48);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = NEON.cyanBright;
  context.font = 'bold 18px sans-serif';
  context.fillText(
    isMiniBreak
      ? `WAVE ${activeWave} · MINI WAVE ${Math.min(miniWave + 1, miniWaveTotal)}/${miniWaveTotal} IN ${Math.max(0, Math.ceil(remainingMs / 1000))}s`
      : `WAVE CLEAR · NEXT IN ${Math.max(0, Math.ceil(remainingMs / 1000))}s`,
    canvas.width / 2,
    y + 18,
  );
  context.fillStyle = withAlpha(isMiniBreak ? NEON.purple : NEON.green, 0.16);
  context.fillRect(x + 18, y + 36, width - 36, 4);
  context.fillStyle = isMiniBreak ? NEON.purple : NEON.green;
  context.fillRect(x + 18, y + 36, (width - 36) * progress, 4);
  context.restore();
}

function drawBossWarningHud() {
  const remainingMs = world.state.bossWarningMs;
  if (remainingMs <= 0 || world.state.boss) return;

  const totalMs = Math.max(1, world.state.bossWarningTotalMs);
  const progress = Math.max(0, Math.min(1, 1 - remainingMs / totalMs));
  const width = 460;
  const x = (canvas.width - width) / 2;
  const y = 92;
  const pulse = 0.72 + Math.sin(world.state.tick * 0.22) * 0.28;

  context.save();
  context.fillStyle = withAlpha(NEON.phosphor, 0.92);
  context.fillRect(x, y, width, 72);
  context.strokeStyle = NEON.red;
  context.lineWidth = 2;
  context.strokeRect(x, y, width, 72);

  context.globalAlpha = pulse;
  context.fillStyle = NEON.pinkBright;
  context.font = 'bold 24px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('WARDEN INCOMING', canvas.width / 2, y + 27);
  context.globalAlpha = 1;

  context.fillStyle = NEON.pink;
  context.font = '14px monospace';
  context.fillText(
    `BOSS SIGNATURE DETECTED · ${Math.max(0, Math.ceil(remainingMs / 1000))}s`,
    canvas.width / 2,
    y + 51,
  );

  context.fillStyle = withAlpha(NEON.red, 0.18);
  context.fillRect(x + 18, y + 62, width - 36, 4);
  context.fillStyle = NEON.red;
  context.fillRect(x + 18, y + 62, (width - 36) * progress, 4);
  context.restore();
}

function drawBoss() {
  const boss = world.state.boss;
  if (!boss || !boss.active) return;

  context.save();
  context.translate(boss.x, boss.y);

  if (boss.patternPhase === 'telegraph') {
    const progress = Math.max(0, Math.min(1, 1 - boss.phaseRemainingMs / 950));
    context.globalAlpha = 0.25 + progress * 0.55;
    context.strokeStyle = NEON.amber;
    context.lineWidth = 2 + progress * 4;
    context.setLineDash([8, 6]);
    context.beginPath();
    context.arc(0, 0, boss.radius + 42, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
  }

  context.fillStyle = NEON.purple;
  context.beginPath();
  context.arc(0, 0, boss.radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = NEON.purpleBright;
  context.lineWidth = 3;
  context.stroke();

  for (const module of boss.modules) {
    if (module.destroyed) continue;
    const moduleX = module.offsetX;
    const moduleY = module.offsetY;
    context.beginPath();
    context.arc(moduleX, moduleY, module.radius, 0, Math.PI * 2);
    context.fillStyle = module.exposed ? NEON.amber : withAlpha(NEON.purple, 0.35);
    context.fill();
    context.strokeStyle = module.exposed ? NEON.amberBright : NEON.purple;
    context.lineWidth = module.exposed ? 3 : 1;
    context.stroke();

    context.fillStyle = NEON.void;
    context.fillRect(moduleX - module.radius, moduleY - module.radius - 7, module.radius * 2, 3);
    context.fillStyle = NEON.amber;
    context.fillRect(moduleX - module.radius, moduleY - module.radius - 7, module.radius * 2 * (module.hp / module.maxHp), 3);
  }

  context.restore();

  context.fillStyle = withAlpha(NEON.textDim, 0.55);
  context.fillRect(380, 28, 520, 12);
  context.fillStyle = NEON.purple;
  context.fillRect(380, 28, (boss.hp / boss.maxHp) * 520, 12);

  const exposedModules = boss.modules.filter((module) => module.exposed && !module.destroyed);
  context.fillStyle = exposedModules.length > 0 ? NEON.amber : NEON.purpleBright;
  context.font = '14px sans-serif';
  context.textAlign = 'center';
  context.fillText(
    exposedModules.length > 0
      ? `WEAK POINT: ${exposedModules.map((module) => module.id).join(', ')}`
      : `WARDEN GEN${boss.generation} · ${boss.patternId}`,
    640,
    60,
  );
  context.textAlign = 'left';
}

function drawPowerUps() {
  for (const powerUp of world.state.powerUps) {
    const definition = powerUpDefinition(powerUp.type);
    const pulse = 0.8 + Math.sin((world.state.tick + powerUp.id) * 0.12) * 0.2;
    context.save();
    context.translate(powerUp.x, powerUp.y);
    context.globalAlpha = pulse;
    context.fillStyle = POWER_UP_COLORS[powerUp.type] ?? definition.color;
    context.strokeStyle = NEON.white;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, -powerUp.radius - 4);
    context.lineTo(powerUp.radius + 4, 0);
    context.lineTo(0, powerUp.radius + 4);
    context.lineTo(-powerUp.radius - 4, 0);
    context.closePath();
    context.fill();
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = NEON.phosphor;
    context.font = 'bold 9px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(definition.label.slice(0, 1), 0, 1);
    context.restore();
  }
}

function drawPickups() {
  for (const pickup of world.state.pickups) {
    context.fillStyle = NEON.green;
    context.beginPath();
    context.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawHud() {
  const p = world.state.player;

  // Dark phosphor plates keep telemetry legible where the vector grid meets
  // the HUD without adding large opaque rectangles to the playfield.
  context.fillStyle = withAlpha(NEON.void, 0.68);
  context.fillRect(52, 10, 390, 98);
  context.strokeStyle = withAlpha(NEON.cyan, 0.22);
  context.lineWidth = 1;
  context.strokeRect(52, 10, 390, 98);

  context.save();
  context.shadowColor = withAlpha(NEON.cyan, 0.5);
  context.shadowBlur = 6;
  context.font = 'bold 15px monospace';
  context.fillStyle = NEON.cyanBright;
  context.fillText(`HP ${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`, 64, 30);
  context.fillStyle = NEON.amber;
  context.fillText(`XP ${world.state.xp}`, 64, 52);
  context.fillStyle = NEON.purpleBright;
  context.fillText(`CHAIN x${world.state.chain.multiplier} (${world.state.chain.count})`, 64, 74);
  context.fillStyle = NEON.textMuted;
  context.font = '12px monospace';
  context.fillText(`SOUND ${audio.muted ? 'OFF' : 'ON'} (N) · ${MUSIC_BPM} BPM`, 64, 96);
  context.restore();

  context.fillStyle = withAlpha(NEON.void, 0.68);
  context.fillRect(1090, 10, 140, 54);
  context.strokeStyle = withAlpha(NEON.cyan, 0.22);
  context.strokeRect(1090, 10, 140, 54);
  context.save();
  context.shadowColor = withAlpha(NEON.amber, 0.45);
  context.shadowBlur = 6;
  context.font = 'bold 15px monospace';
  context.textAlign = 'right';
  context.fillStyle = NEON.amber;
  const activeWave = world.state.activeWave ?? world.state.wave;
  const miniWave = world.state.miniWave ?? 0;
  const miniWaveTotal = world.state.miniWaveTotal ?? 0;
  const waveLabel =
    miniWaveTotal > 1 && miniWave > 0
      ? `WAVE ${activeWave} · ${miniWave}/${miniWaveTotal}`
      : `WAVE ${activeWave}`;
  context.fillText(waveLabel, 1218, 30);
  context.fillStyle = p.surgeCooldown <= 0 ? NEON.cyanBright : NEON.textMuted;
  context.fillText(
    `SURGE ${p.surgeCooldown <= 0 ? 'READY' : `${Math.ceil(p.surgeCooldown)}ms`}`,
    1218,
    52,
  );
  context.restore();
  context.textAlign = 'left';

  const panelX = UPGRADE_AXIS_LAYOUT.panelX;
  const panelY = UPGRADE_AXIS_LAYOUT.panelY;
  context.fillStyle = withAlpha(NEON.panel, 0.94);
  context.fillRect(panelX, panelY, UPGRADE_AXIS_LAYOUT.panelWidth, UPGRADE_AXIS_LAYOUT.panelHeight);
  context.strokeStyle = withAlpha(NEON.cyan, 0.3);
  context.lineWidth = 1;
  context.strokeRect(panelX, panelY, UPGRADE_AXIS_LAYOUT.panelWidth, UPGRADE_AXIS_LAYOUT.panelHeight);

  // Compact legend instead of a full-width header. This lets the strip live
  // below the playable arena while keeping the upgrade controls discoverable.
  context.textAlign = 'left';
  context.font = 'bold 10px monospace';
  context.fillStyle = NEON.cyan;
  context.fillText('AXES', panelX + 14, panelY + 18);
  context.fillStyle = NEON.amber;
  context.fillText(`XP ${world.state.xp}`, panelX + 14, panelY + 34);
  context.font = '8px monospace';
  context.fillStyle = NEON.textMuted;
  context.fillText(
    state.gamepad.connected ? 'D-PAD · A' : 'Q/E · ENTER',
    panelX + 14,
    panelY + 48,
  );

  UPGRADE_AXIS_DEFINITIONS.forEach((definition, index) => {
    const x = UPGRADE_AXIS_LAYOUT.firstCardX + index * UPGRADE_AXIS_LAYOUT.cardStepX;
    const y = UPGRADE_AXIS_LAYOUT.firstCardY;
    const selected = index === state.upgradeSelection;
    const cost = upgradeAxisCost(definition.axis, world.state.axisLevels[definition.axis]);
    const affordable = world.state.xp >= cost;
    context.fillStyle = selected ? NEON.panelRaised : NEON.phosphor;
    context.fillRect(x, y, UPGRADE_AXIS_LAYOUT.cardWidth, UPGRADE_AXIS_LAYOUT.cardHeight);
    context.strokeStyle = selected ? NEON.amber : withAlpha(NEON.cyan, 0.22);
    context.lineWidth = selected ? 3 : 1;
    if (selected) {
      context.save();
      context.shadowColor = withAlpha(NEON.amber, 0.7);
      context.shadowBlur = 12;
      context.strokeRect(x, y, UPGRADE_AXIS_LAYOUT.cardWidth, UPGRADE_AXIS_LAYOUT.cardHeight);
      context.restore();
    } else {
      context.strokeRect(x, y, UPGRADE_AXIS_LAYOUT.cardWidth, UPGRADE_AXIS_LAYOUT.cardHeight);
    }
    context.lineWidth = 1;

    context.fillStyle = selected ? NEON.amberBright : NEON.text;
    context.font = 'bold 14px monospace';
    context.fillText(definition.label, x + 12, y + 21);
    context.font = '12px monospace';
    context.fillStyle = NEON.textMuted;
    context.fillText(`LV ${world.state.axisLevels[definition.axis]}`, x + 12, y + 42);
    context.textAlign = 'right';
    context.fillStyle = affordable ? NEON.green : NEON.textDim;
    context.fillText(`${cost} XP`, x + UPGRADE_AXIS_LAYOUT.cardWidth - 12, y + 42);
    context.textAlign = 'left';
  });

  context.font = '12px monospace';
  context.fillStyle = NEON.textDim;
  context.textAlign = 'right';
  context.fillText(formatBuildLabel(), 1220, 690);
  context.textAlign = 'left';
}

function drawParticles() {
  for (const particle of state.particles.getParticles()) {
    const alpha = Math.max(0, Math.min(1, particle.life / Math.max(1, particle.maxLife ?? particle.life)));
    context.globalAlpha = alpha;
    context.fillStyle = particle.color ?? NEON.white;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size ?? 2, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawScreenEffects() {
  const player = world.state.player;
  const healthFraction = Math.max(0, Math.min(1, player.hp / Math.max(1, player.maxHp)));

  if (state.damageFlashMs > 0) {
    context.fillStyle = withAlpha(
      NEON.red,
      0.2 * Math.min(1, state.damageFlashMs / 140),
    );
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (state.powerUpFlashMs > 0) {
    context.fillStyle = withAlpha(
      NEON.green,
      0.12 * Math.min(1, state.powerUpFlashMs / 180),
    );
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (healthFraction < 0.25 && world.state.status === 'playing') {
    const pulse = 0.5 + Math.sin(world.state.tick * 0.16) * 0.5;
    const healthVignette = context.createRadialGradient(640, 360, 160, 640, 360, 620);
    healthVignette.addColorStop(0, withAlpha(NEON.red, 0));
    healthVignette.addColorStop(1, withAlpha(NEON.red, 0.12 + pulse * 0.14));
    context.fillStyle = healthVignette;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Cached vignette + scanline layer: one blit keeps the always-on CRT
  // treatment cheap enough to leave ample frame budget for gameplay.
  context.drawImage(getCrtOverlayCanvas(), 0, 0);

  // Restrained chromatic split around the selected axis card. The offset is a
  // single pixel so it reads as CRT convergence rather than a second border.
  if (state.screen.phase === 'playing' && world.state.status === 'playing') {
    const selectedX =
      UPGRADE_AXIS_LAYOUT.firstCardX + state.upgradeSelection * UPGRADE_AXIS_LAYOUT.cardStepX;
    const selectedY = UPGRADE_AXIS_LAYOUT.firstCardY;
    const accentPulse = 0.16 + (0.5 + Math.sin(world.state.tick * 0.09) * 0.5) * 0.1;
    context.save();
    context.globalCompositeOperation = 'screen';
    context.globalAlpha = accentPulse;
    context.lineWidth = 1;
    context.strokeStyle = NEON.cyan;
    context.strokeRect(
      selectedX - 1,
      selectedY - 1,
      UPGRADE_AXIS_LAYOUT.cardWidth + 2,
      UPGRADE_AXIS_LAYOUT.cardHeight + 2,
    );
    context.strokeStyle = NEON.pink;
    context.strokeRect(
      selectedX + 1,
      selectedY + 1,
      UPGRADE_AXIS_LAYOUT.cardWidth - 2,
      UPGRADE_AXIS_LAYOUT.cardHeight - 2,
    );
    context.restore();
  }

}

function drawStatus() {
  const won = world.state.status === 'won';
  const lost = world.state.status === 'lost';
  if (!won && !lost) return;

  context.fillStyle = withAlpha(NEON.void, 0.8);
  context.fillRect(400, 286, 480, 122);
  context.strokeStyle = won ? withAlpha(NEON.cyan, 0.65) : withAlpha(NEON.pink, 0.65);
  context.lineWidth = 1.5;
  context.strokeRect(400, 286, 480, 122);

  context.textAlign = 'center';
  context.save();
  context.shadowColor = won ? withAlpha(NEON.cyan, 0.8) : withAlpha(NEON.pink, 0.8);
  context.shadowBlur = 18;
  context.fillStyle = won ? NEON.cyanBright : NEON.pinkBright;
  context.font = 'bold 36px monospace';
  context.fillText(won ? 'VICTORY' : 'DEFEAT', 640, 340);
  context.shadowBlur = 0;
  context.fillStyle = NEON.textMuted;
  context.font = '15px monospace';
  context.fillText('PRESS R TO RESTART', 640, 382);
  context.restore();
  context.textAlign = 'left';
}

function drawTitleScreen() {
  context.fillStyle = getTitleBackgroundGradient();
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Perspective vector floor: a low-cost retro grid that frames the title
  // without obscuring the instructions.
  context.save();
  context.beginPath();
  context.rect(0, 0, canvas.width, canvas.height);
  context.clip();
  const horizonY = 365;
  context.strokeStyle = withAlpha(NEON.cyan, 0.1);
  context.lineWidth = 1;
  context.beginPath();
  for (let index = 0; index < 15; index += 1) {
    const y = horizonY + Math.pow(index / 14, 1.65) * 355;
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
  }
  for (let index = -12; index <= 12; index += 1) {
    context.moveTo(640 + index * 7, horizonY);
    context.lineTo(640 + index * 138, canvas.height);
  }
  context.stroke();

  context.shadowColor = withAlpha(NEON.purple, 0.8);
  context.shadowBlur = 15;
  context.strokeStyle = withAlpha(NEON.purple, 0.5);
  context.beginPath();
  context.moveTo(120, horizonY);
  context.lineTo(1160, horizonY);
  context.stroke();
  context.restore();

  const pulse = 0.65 + Math.sin(performance.now() / 420) * 0.35;
  context.textAlign = 'center';

  context.fillStyle = NEON.textDim;
  context.font = '12px monospace';
  context.fillText('FOUNDRY VECTOR SYSTEM // CRT-07', canvas.width / 2, 112);

  // Chromatic ghosting plus a cyan bloom gives the wordmark a vector-monitor
  // feel while retaining a solid high-contrast core for readability.
  context.save();
  context.globalCompositeOperation = 'screen';
  context.globalAlpha = 0.34;
  context.font = 'bold 94px monospace';
  context.fillStyle = NEON.pink;
  context.fillText('CINDER', 646, 246);
  context.fillStyle = NEON.purple;
  context.fillText('CINDER', 634, 246);
  context.restore();

  context.save();
  context.shadowColor = withAlpha(NEON.cyan, 0.9);
  context.shadowBlur = 30;
  context.fillStyle = NEON.cyanBright;
  context.font = 'bold 94px monospace';
  context.fillText('CINDER', 640, 246);
  context.restore();

  const titleRule = context.createLinearGradient(430, 0, 850, 0);
  titleRule.addColorStop(0, withAlpha(NEON.pink, 0));
  titleRule.addColorStop(0.5, withAlpha(NEON.cyan, 0.7));
  titleRule.addColorStop(1, withAlpha(NEON.pink, 0));
  context.strokeStyle = titleRule;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(430, 270);
  context.lineTo(850, 270);
  context.stroke();

  context.fillStyle = NEON.textMuted;
  context.font = '16px monospace';
  context.fillText(
    'SURVIVE THE SHIFTING ARENA. AIM TRUE. SURGE THROUGH THE FIRE.',
    canvas.width / 2,
    306,
  );

  context.fillStyle = withAlpha(NEON.panel, 0.76);
  context.fillRect(310, 382, 660, 104);
  context.strokeStyle = withAlpha(NEON.cyan, 0.28);
  context.lineWidth = 1;
  context.strokeRect(310, 382, 660, 104);

  context.fillStyle = NEON.textMuted;
  context.font = '15px monospace';
  context.fillText('WASD / ARROWS MOVE  ·  MOUSE AIMS + FIRES  ·  SPACE SURGES', canvas.width / 2, 418);
  context.fillText(
    'CONTROLLER: LEFT STICK MOVE  ·  RIGHT STICK AIM + FIRE  ·  B/RB SURGE',
    canvas.width / 2,
    450,
  );

  context.save();
  context.globalAlpha = pulse;
  context.shadowColor = withAlpha(NEON.amber, 0.95);
  context.shadowBlur = 18;
  context.fillStyle = NEON.amberBright;
  context.font = 'bold 22px monospace';
  context.fillText('PRESS ENTER, CLICK, OR PRESS A/START TO BEGIN', canvas.width / 2, 548);
  context.restore();

  context.fillStyle = NEON.textDim;
  context.font = '12px monospace';
  context.fillText(formatBuildLabel(), canvas.width / 2, 682);
  context.textAlign = 'left';
}

function startGame(): void {
  if (!startGameFromTitle(state.screen)) return;

  state.loop = createFixedStepLoopState();
  state.queuedSurge = false;
  state.gamepadSurgeQueued = false;
  mouse.down = false;
  telemetry.emitRunStart(world.state);
}

function render() {
  if (state.screen.phase === 'title') {
    drawTitleScreen();
    drawScreenEffects();
    return;
  }

  context.save();
  context.translate(state.camera.x, state.camera.y);
  drawArena();
  drawProjectiles();
  drawPowerUps();
  drawPickups();
  drawBossWarning();
  drawBoss();
  drawEnemies();
  drawParticles();
  drawPlayer();
  context.restore();
  drawHud();
  drawWaveBreakHud();
  drawBossWarningHud();
  drawStatus();
  drawScreenEffects();
}

function runGameLoop(timestamp: number) {
  const previousGamepad = state.gamepad;
  const currentGamepad = readGamepadInput();

  if (state.screen.phase === 'title') {
    state.gamepad = currentGamepad;
    if (isTitleStartGamepadInput(previousGamepad, currentGamepad)) {
      audio.unlock();
      startGame();
    }
    render();
    requestAnimationFrame(runGameLoop);
    return;
  }

  const loopResult = updateFixedStepLoop(state.loop, timestamp, {
    tickRateHz: 60,
    maxCatchUpSteps: 5,
  });
  state.loop = loopResult.state;
  state.camera = stepCamera(state.camera, loopResult.stepDtMs, world.state.tick);
  state.particles.step(loopResult.stepDtMs);
  state.damageFlashMs = Math.max(0, state.damageFlashMs - loopResult.stepDtMs);
  state.powerUpFlashMs = Math.max(0, state.powerUpFlashMs - loopResult.stepDtMs);

  handleGamepadUi(previousGamepad, currentGamepad);
  state.gamepad = currentGamepad;
  if (currentGamepad.surge && !previousGamepad.surge) {
    state.gamepadSurgeQueued = true;
  }

  audio.updateMusic(
    world.state.tick,
    world.state.boss?.active ?? false,
    world.state.status !== 'playing',
    world.state.wave,
  );

  if (state.hitStopMs > 0) {
    state.hitStopMs = Math.max(0, state.hitStopMs - loopResult.stepDtMs);
    render();
    requestAnimationFrame(runGameLoop);
    return;
  }

  for (let step = 0; step < loopResult.steps; step += 1) {
    const tick = world.state.tick;
    const input = getInput(tick);
    state.queuedSurge = false;
    state.gamepadSurgeQueued = false;
    if (world.state.status === 'playing') {
      const events = world.step(input);
      telemetry.emitSimEvents(world.state, events);
      for (const event of events) {
        const sound = soundForSimEvent(event);
        if (sound) audio.playEffect(sound);
        for (const particle of particlesForSimEvent(event)) {
          state.particles.add(particle);
        }
        const trauma = cameraTraumaForSimEvent(event);
        if (trauma > 0) state.camera = addTrauma(state.camera, trauma);

        if (event.type === 'player_hit') {
          state.damageFlashMs = Math.max(state.damageFlashMs, 160);
        }
        if (event.type === 'powerup_collected') {
          state.powerUpFlashMs = Math.max(state.powerUpFlashMs, 190);
        }
      }
      if (events.some((event) => event.type === 'enemy_died')) {
        state.hitStopMs = Math.max(state.hitStopMs, 28);
      }
      if (events.some((event) => event.type === 'player_hit')) {
        state.hitStopMs = Math.max(state.hitStopMs, 60);
      }
      if (events.some((event) => event.type === 'boss_module_destroyed')) {
        state.hitStopMs = Math.max(state.hitStopMs, 45);
      }

      if (world.state.wave !== state.lastWave) {
        telemetry.emit('wave_start', {
          waveId: `wave_${String(world.state.wave).padStart(2, '0')}`,
          threatSpent: world.state.enemies.length,
          durationMs: world.state.waveTimer,
        });
        state.lastWave = world.state.wave;
        audio.playEffect('wave_start');
      }

      const runEnded = events.find((event) => event.type === 'run_ended');
      if (runEnded) {
        const outcome = (runEnded.data?.outcome as 'victory' | 'defeat' | undefined) ?? 'defeat';
        telemetry.emitRunEnd(world.state, outcome);
        telemetry.flushToConsoleSummary();
        state.endedAtMs = performance.now();
      }
    }
  }

  render();
  requestAnimationFrame(runGameLoop);
}

function restartRun(): void {
  if (state.endedAtMs > 0) {
    telemetry.emitRestart(Math.max(0, Math.floor(performance.now() - state.endedAtMs)));
    state.endedAtMs = 0;
  }
  world.restart();
  state.particles.clear();
  state.damageFlashMs = 0;
  state.powerUpFlashMs = 0;
  audio.playEffect('restart');
  state.lastWave = world.state.wave;
  state.upgradeSelection = 0;
  state.queuedSurge = false;
  state.gamepadSurgeQueued = false;
  telemetry.emitRunStart(world.state);
}

function handleGamepadUi(previous: GamepadInput, current: GamepadInput): void {
  if (
    current.connected &&
    (current.fire || current.surge || current.confirm || current.start)
  ) {
    audio.unlock();
  }

  if (current.menuNext && !previous.menuNext) {
    state.upgradeSelection = (state.upgradeSelection + 1) % UPGRADE_AXES.length;
    audio.playEffect('menu_move');
  }
  if (current.menuPrevious && !previous.menuPrevious) {
    state.upgradeSelection =
      (state.upgradeSelection - 1 + UPGRADE_AXES.length) % UPGRADE_AXES.length;
    audio.playEffect('menu_move');
  }
  if (current.confirm && !previous.confirm) {
    levelAxis(state.upgradeSelection);
  }

  if (current.start && !previous.start && !current.confirm) {
    restartRun();
  }
}

function handleKey(event: KeyboardEvent, isPressed: boolean) {
  const key = event.key.toLowerCase();

  if (isPressed && key === 'q') {
    state.upgradeSelection = (state.upgradeSelection - 1 + UPGRADE_AXES.length) % UPGRADE_AXES.length;
    audio.playEffect('menu_move');
  }
  if (isPressed && key === 'e') {
    state.upgradeSelection = (state.upgradeSelection + 1) % UPGRADE_AXES.length;
    audio.playEffect('menu_move');
  }
  if (isPressed && key === 'enter') {
    levelAxis(state.upgradeSelection);
  }
  if (isPressed && /^[1-5]$/.test(key)) {
    levelAxis(Number(key) - 1);
  }

  if (key === 'w' || key === 'arrowup') pressed.w = isPressed;
  if (key === 'a' || key === 'arrowleft') pressed.a = isPressed;
  if (key === 's' || key === 'arrowdown') pressed.s = isPressed;
  if (key === 'd' || key === 'arrowright') pressed.d = isPressed;
  if (key === ' ' && isPressed) {
    state.queuedSurge = true;
  }
  if (key === 'r' && isPressed) {
    restartRun();
  }
  if (key === 'm' && isPressed) {
    state.camera = { ...state.camera, reducedMotion: !state.camera.reducedMotion };
  }
  if (key === 'n' && isPressed) {
    audio.toggleMuted();
  }
}

window.addEventListener('keydown', (event) => {
  audio.unlock();
  if (state.screen.phase === 'title') {
    if (isTitleStartKey(event.key)) {
      event.preventDefault();
      startGame();
    }
    return;
  }
  handleKey(event, true);
});
window.addEventListener('keyup', (event) => handleKey(event, false));
window.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
});
function levelAxis(index: number): boolean {
  const axis: UpgradeAxis | undefined = UPGRADE_AXES[index];
  if (!axis) return false;

  const cost = upgradeAxisCost(axis, world.state.axisLevels[axis]);
  if (world.state.xp < cost) return false;

  world.applyUpgrade(axis);
  state.upgradeSelection = index;
  audio.playEffect('upgrade');
  telemetry.emit('upgrade_bought', {
    nodeId: axis,
    axis,
    tokensSpent: cost,
  });
  return true;
}

function levelAxisAt(clientX: number, clientY: number): boolean {
  const rect = canvas.getBoundingClientRect();
  const point = canvasPointFromClient(
    clientX,
    clientY,
    rect,
    canvas.width,
    canvas.height,
  );
  const index = upgradeAxisIndexAt(point, UPGRADE_AXES.length);
  if (index < 0) return false;
  state.upgradeSelection = index;
  levelAxis(index);
  return true;
}

window.addEventListener('pointerdown', (event) => {
  audio.unlock();
  if (state.screen.phase === 'title') {
    event.preventDefault();
    startGame();
    return;
  }
  if (levelAxisAt(event.clientX, event.clientY)) {
    event.preventDefault();
    mouse.down = false;
    return;
  }
  mouse.down = true;
});
window.addEventListener('pointerup', () => {
  mouse.down = false;
});

requestAnimationFrame(runGameLoop);
