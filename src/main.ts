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

const canvas = document.createElement('canvas');
canvas.width = 1280;
canvas.height = 720;
const rawContext = canvas.getContext('2d');
if (!rawContext) {
  throw new Error('Unable to create 2D context for canvas.');
}
const context: CanvasRenderingContext2D = rawContext;

document.body.appendChild(canvas);

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

function drawArena() {
  context.fillStyle = '#070b16';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#3b82f6';
  context.fillRect(40, 40, 1200, 640);
  context.fillStyle = '#060d17';
  context.fillRect(55, 55, 1170, 610);

  for (let x = 90; x < 1190; x += 60) {
    context.strokeStyle = '#1a243d';
    context.beginPath();
    context.moveTo(x, 60);
    context.lineTo(x, 660);
    context.stroke();
  }

  for (let y = 80; y < 640; y += 60) {
    context.strokeStyle = '#1a243d';
    context.beginPath();
    context.moveTo(60, y);
    context.lineTo(1220, y);
    context.stroke();
  }

  const current = foundryLayouts.find((layout) => layout.id === world.state.arena.currentLayoutId);
  if (current) {
    context.fillStyle = '#0b1324';
    context.beginPath();
    current.polygon.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.fill();
    context.strokeStyle = '#1f2a44';
    context.lineWidth = 3;
    context.stroke();
  }

  if (world.state.arena.nextLayoutId && world.state.arena.telegraphMsRemaining > 0) {
    const next = foundryLayouts.find((layout) => layout.id === world.state.arena.nextLayoutId);
    if (next) {
      const cue = computeTelegraphCue(world.state.arena.telegraphMsRemaining);
      context.save();

      // Cue 3: incoming footprint fill.
      context.globalAlpha = cue.hatchAlpha;
      context.fillStyle = '#f59e0b';
      context.beginPath();
      next.polygon.forEach(([x, y], index) => {
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.fill();

      // Cue 1: pulsing edge of the incoming shape.
      context.globalAlpha = cue.edgeAlpha;
      context.setLineDash([10, 8]);
      context.strokeStyle = '#fbbf24';
      context.lineWidth = cue.edgeWidth;
      context.beginPath();
      next.polygon.forEach(([x, y], index) => {
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.stroke();

      // Cue 2: expanding decal ring centred on the arena.
      context.setLineDash([]);
      context.globalAlpha = cue.decalAlpha;
      context.strokeStyle = '#fde68a';
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
  context.strokeStyle = '#7dd3fc';
  context.fillStyle = '#c4b5fd';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, p.radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(p.aimX * 28, p.aimY * 28);
  context.stroke();

  if (p.surgeTimer > 0) {
    context.globalAlpha = Math.min(1, p.surgeTimer / 140);
    context.strokeStyle = '#67e8f9';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, p.radius + 9, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }

  context.restore();
}

function drawProjectiles() {
  for (const projectile of world.state.projectiles) {
    if (projectile.owner === 'player' && projectile.kind === 'missile') {
      context.fillStyle = '#fbbf24';
      context.save();
      context.translate(projectile.x, projectile.y);
      context.rotate(Math.atan2(projectile.vy, projectile.vx));
      context.beginPath();
      context.moveTo(projectile.radius + 4, 0);
      context.lineTo(-projectile.radius, projectile.radius);
      context.lineTo(-projectile.radius, -projectile.radius);
      context.closePath();
      context.fill();
      context.restore();
      continue;
    }
    context.fillStyle = projectile.owner === 'player' ? '#7dd3fc' : '#f97316';
    context.beginPath();
    context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    context.fill();
  }
}

function enemyColor(kind: string): string {
  if (kind === 'turret' || kind === 'lancer') return '#fbbf24';
  if (kind === 'bomber') return '#fb923c';
  if (kind === 'weaver') return '#c084fc';
  if (kind === 'spinner') return '#f472b6';
  if (kind === 'splitter') return '#a3e635';
  if (kind === 'charger') return '#f87171';
  return '#ef4444';
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
      context.strokeStyle = '#fb7185';
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
    context.strokeStyle = '#f59e0b';
    context.lineWidth = 2;

    if (enemy.kind === 'bomber') {
      context.beginPath();
      context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.strokeStyle = '#fed7aa';
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
      context.fillStyle = '#fecdd3';
      context.font = 'bold 18px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('!', enemy.x, enemy.y);
      context.restore();
      continue;
    }

    context.fillStyle = '#d1d5db';
    context.fillRect(enemy.x - 18, enemy.y - enemy.radius - 12, 36, 4);
    context.fillStyle = '#34d399';
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
  context.fillStyle = '#ef4444';
  context.beginPath();
  context.arc(0, 0, 150, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  for (let ring = 0; ring < 3; ring += 1) {
    const radius = 48 + ring * 30 + progress * 18;
    context.globalAlpha = Math.max(0.12, pulse - ring * 0.12);
    context.strokeStyle = ring === 1 ? '#fbbf24' : '#f87171';
    context.lineWidth = ring === 0 ? 4 : 2;
    context.setLineDash(ring === 1 ? [10, 8] : []);
    context.beginPath();
    context.arc(0, 0, radius, world.state.tick * 0.02 + ring, Math.PI * 2 + world.state.tick * 0.02 + ring);
    context.stroke();
  }
  context.setLineDash([]);
  context.globalAlpha = 1;

  context.strokeStyle = '#fecaca';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-18, 0);
  context.lineTo(18, 0);
  context.moveTo(0, -18);
  context.lineTo(0, 18);
  context.stroke();

  context.fillStyle = '#fef2f2';
  context.font = 'bold 22px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('!', 0, 1);
  context.restore();
}

function drawWaveBreakHud() {
  const breakMs = world.state.waveBreakMs;
  if (breakMs === null || breakMs <= 0) return;

  const totalMs = Math.max(1, world.state.waveBreakTotalMs);
  const progress = Math.max(0, Math.min(1, 1 - breakMs / totalMs));
  const width = 340;
  const x = (canvas.width - width) / 2;
  const y = 104;

  context.save();
  context.fillStyle = 'rgba(6, 30, 24, 0.82)';
  context.fillRect(x, y, width, 48);
  context.strokeStyle = '#34d399';
  context.lineWidth = 1;
  context.strokeRect(x, y, width, 48);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#a7f3d0';
  context.font = 'bold 18px sans-serif';
  context.fillText(
    `WAVE CLEAR · NEXT IN ${Math.max(0, Math.ceil(breakMs / 1000))}s`,
    canvas.width / 2,
    y + 18,
  );
  context.fillStyle = '#064e3b';
  context.fillRect(x + 18, y + 36, width - 36, 4);
  context.fillStyle = '#34d399';
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
  context.fillStyle = 'rgba(45, 10, 10, 0.9)';
  context.fillRect(x, y, width, 72);
  context.strokeStyle = '#ef4444';
  context.lineWidth = 2;
  context.strokeRect(x, y, width, 72);

  context.globalAlpha = pulse;
  context.fillStyle = '#fecaca';
  context.font = 'bold 24px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('WARDEN INCOMING', canvas.width / 2, y + 27);
  context.globalAlpha = 1;

  context.fillStyle = '#fca5a5';
  context.font = '14px monospace';
  context.fillText(
    `BOSS SIGNATURE DETECTED · ${Math.max(0, Math.ceil(remainingMs / 1000))}s`,
    canvas.width / 2,
    y + 51,
  );

  context.fillStyle = '#450a0a';
  context.fillRect(x + 18, y + 62, width - 36, 4);
  context.fillStyle = '#f87171';
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
    context.strokeStyle = '#fbbf24';
    context.lineWidth = 2 + progress * 4;
    context.setLineDash([8, 6]);
    context.beginPath();
    context.arc(0, 0, boss.radius + 42, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
  }

  context.fillStyle = '#a78bfa';
  context.beginPath();
  context.arc(0, 0, boss.radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#ddd6fe';
  context.lineWidth = 3;
  context.stroke();

  for (const module of boss.modules) {
    if (module.destroyed) continue;
    const moduleX = module.offsetX;
    const moduleY = module.offsetY;
    context.beginPath();
    context.arc(moduleX, moduleY, module.radius, 0, Math.PI * 2);
    context.fillStyle = module.exposed ? '#fbbf24' : '#4c1d95';
    context.fill();
    context.strokeStyle = module.exposed ? '#fde68a' : '#7c3aed';
    context.lineWidth = module.exposed ? 3 : 1;
    context.stroke();

    context.fillStyle = '#111827';
    context.fillRect(moduleX - module.radius, moduleY - module.radius - 7, module.radius * 2, 3);
    context.fillStyle = '#f59e0b';
    context.fillRect(moduleX - module.radius, moduleY - module.radius - 7, module.radius * 2 * (module.hp / module.maxHp), 3);
  }

  context.restore();

  context.fillStyle = '#374151';
  context.fillRect(380, 28, 520, 12);
  context.fillStyle = '#a78bfa';
  context.fillRect(380, 28, (boss.hp / boss.maxHp) * 520, 12);

  const exposedModules = boss.modules.filter((module) => module.exposed && !module.destroyed);
  context.fillStyle = exposedModules.length > 0 ? '#fbbf24' : '#c4b5fd';
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
    context.fillStyle = definition.color;
    context.strokeStyle = '#f8fafc';
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
    context.fillStyle = '#0f172a';
    context.font = 'bold 9px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(definition.label.slice(0, 1), 0, 1);
    context.restore();
  }
}

function drawPickups() {
  for (const pickup of world.state.pickups) {
    context.fillStyle = '#34d399';
    context.beginPath();
    context.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawHud() {
  const p = world.state.player;
  context.fillStyle = '#e5e7eb';
  context.font = '16px sans-serif';
  context.fillText(`HP ${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`, 60, 28);
  context.fillText(`XP ${world.state.xp}`, 60, 52);
  context.fillText(`Chain x${world.state.chain.multiplier} (${world.state.chain.count})`, 60, 76);
  context.fillText(`Sound ${audio.muted ? 'Off' : 'On'} (N) · Music ${MUSIC_BPM} BPM`, 60, 100);
  context.fillText(`Wave ${world.state.wave}`, 1160, 28);
  context.fillText(`Surge ${p.surgeCooldown <= 0 ? 'Ready' : `${Math.ceil(p.surgeCooldown)}ms`}`, 1160, 52);

  const panelX = UPGRADE_AXIS_LAYOUT.panelX;
  const panelY = UPGRADE_AXIS_LAYOUT.panelY;
  context.fillStyle = 'rgba(8, 15, 30, 0.9)';
  context.fillRect(panelX, panelY, UPGRADE_AXIS_LAYOUT.panelWidth, UPGRADE_AXIS_LAYOUT.panelHeight);
  context.strokeStyle = '#334155';
  context.lineWidth = 1;
  context.strokeRect(panelX, panelY, UPGRADE_AXIS_LAYOUT.panelWidth, UPGRADE_AXIS_LAYOUT.panelHeight);

  context.font = '12px sans-serif';
  context.fillStyle = '#94a3b8';
  context.fillText(`AXES · XP ${world.state.xp}`, panelX + 16, panelY + 18);
  context.textAlign = 'right';
  context.fillText(
    state.gamepad.connected
      ? 'D-pad select · A level up · B/RB surge'
      : 'Q/E select · Enter or 1-5 level up · click an axis',
    panelX + UPGRADE_AXIS_LAYOUT.panelWidth - 16,
    panelY + 18,
  );
  context.textAlign = 'left';

  UPGRADE_AXIS_DEFINITIONS.forEach((definition, index) => {
    const x = UPGRADE_AXIS_LAYOUT.firstCardX + index * UPGRADE_AXIS_LAYOUT.cardStepX;
    const y = UPGRADE_AXIS_LAYOUT.firstCardY;
    const selected = index === state.upgradeSelection;
    const cost = upgradeAxisCost(definition.axis, world.state.axisLevels[definition.axis]);
    const affordable = world.state.xp >= cost;
    context.fillStyle = selected ? '#172554' : '#0f172a';
    context.fillRect(x, y, UPGRADE_AXIS_LAYOUT.cardWidth, UPGRADE_AXIS_LAYOUT.cardHeight);
    context.strokeStyle = selected ? '#fbbf24' : '#334155';
    context.lineWidth = selected ? 3 : 1;
    context.strokeRect(x, y, UPGRADE_AXIS_LAYOUT.cardWidth, UPGRADE_AXIS_LAYOUT.cardHeight);
    context.lineWidth = 1;

    context.fillStyle = selected ? '#fde68a' : '#e2e8f0';
    context.font = 'bold 14px sans-serif';
    context.fillText(definition.label, x + 12, y + 21);
    context.font = '12px sans-serif';
    context.fillStyle = '#cbd5e1';
    context.fillText(`Lv ${world.state.axisLevels[definition.axis]}`, x + 12, y + 42);
    context.textAlign = 'right';
    context.fillStyle = affordable ? '#34d399' : '#64748b';
    context.fillText(`${cost} XP`, x + UPGRADE_AXIS_LAYOUT.cardWidth - 12, y + 42);
    context.textAlign = 'left';
  });

  context.font = '12px monospace';
  context.fillStyle = '#64748b';
  context.textAlign = 'right';
  context.fillText(formatBuildLabel(), 1220, 690);
  context.textAlign = 'left';
}

function drawParticles() {
  for (const particle of state.particles.getParticles()) {
    const alpha = Math.max(0, Math.min(1, particle.life / Math.max(1, particle.maxLife ?? particle.life)));
    context.globalAlpha = alpha;
    context.fillStyle = particle.color ?? '#f8fafc';
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
    context.fillStyle = `rgba(239, 68, 68, ${0.2 * Math.min(1, state.damageFlashMs / 140)})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (state.powerUpFlashMs > 0) {
    context.fillStyle = `rgba(52, 211, 153, ${0.12 * Math.min(1, state.powerUpFlashMs / 180)})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (healthFraction < 0.25 && world.state.status === 'playing') {
    const pulse = 0.5 + Math.sin(world.state.tick * 0.16) * 0.5;
    const vignette = context.createRadialGradient(640, 360, 160, 640, 360, 620);
    vignette.addColorStop(0, 'rgba(127, 29, 29, 0)');
    vignette.addColorStop(1, `rgba(127, 29, 29, ${0.12 + pulse * 0.14})`);
    context.fillStyle = vignette;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawStatus() {
  context.fillStyle = '#f8fafc';
  context.font = 'bold 36px sans-serif';
  context.textAlign = 'center';
  if (world.state.status === 'won') {
    context.fillText('Victory', 640, 340);
    context.font = '20px sans-serif';
    context.fillText('Press R to Restart', 640, 380);
  }
  if (world.state.status === 'lost') {
    context.fillText('Defeat', 640, 340);
    context.font = '20px sans-serif';
    context.fillText('Press R to Restart', 640, 380);
  }
  context.textAlign = 'left';
}

function drawTitleScreen() {
  const background = context.createRadialGradient(640, 320, 20, 640, 320, 620);
  background.addColorStop(0, '#172554');
  background.addColorStop(0.55, '#090f23');
  background.addColorStop(1, '#02040a');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const pulse = 0.65 + Math.sin(performance.now() / 420) * 0.35;
  context.textAlign = 'center';

  context.fillStyle = '#7dd3fc';
  context.font = 'bold 86px sans-serif';
  context.fillText('CINDER', canvas.width / 2, 250);

  context.fillStyle = '#cbd5e1';
  context.font = '20px sans-serif';
  context.fillText(
    'Survive the shifting arena. Aim true. Surge through the fire.',
    canvas.width / 2,
    296,
  );

  context.fillStyle = '#94a3b8';
  context.font = '16px sans-serif';
  context.fillText('WASD / arrows move  ·  Mouse aims and fires  ·  Space surges', canvas.width / 2, 400);
  context.fillText(
    'Controller: left stick move  ·  right stick aims and fires  ·  B/RB surges',
    canvas.width / 2,
    428,
  );

  context.globalAlpha = pulse;
  context.fillStyle = '#f8fafc';
  context.font = 'bold 24px sans-serif';
  context.fillText('Press Enter, click, or press A/Start to begin', canvas.width / 2, 535);
  context.globalAlpha = 1;

  context.fillStyle = '#64748b';
  context.font = '13px monospace';
  context.fillText(formatBuildLabel(), canvas.width / 2, 680);
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
  drawScreenEffects();
  drawStatus();
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
