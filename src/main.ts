import './style.css';
import { createInputFrame, createWorld } from './sim/world';

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
world.setDeck('bulwark');

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
  lastTimestamp: 0,
  accumulator: 0,
};

function getInput(tick: number): ReturnType<typeof createInputFrame> {
  const moveX = (pressed.d ? 1 : 0) - (pressed.a ? 1 : 0);
  const moveY = (pressed.s ? 1 : 0) - (pressed.w ? 1 : 0);
  const aimX = mouse.x - 640;
  const aimY = mouse.y - 360;

  return createInputFrame(tick, {
    moveX,
    moveY,
    aimX,
    aimY,
    fire: mouse.down,
    surge: false,
  });
}

function drawArena() {
  context.fillStyle = '#070b16';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = '#1f2a44';
  context.lineWidth = 2;
  context.strokeRect(40, 40, 1200, 640);

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
  context.restore();
}

function drawProjectiles() {
  for (const projectile of world.state.projectiles) {
    context.fillStyle = projectile.owner === 'player' ? '#7dd3fc' : '#f97316';
    context.beginPath();
    context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawEnemies() {
  for (const enemy of world.state.enemies) {
    context.fillStyle = enemy.kind === 'turret' ? '#fbbf24' : '#ef4444';
    context.strokeStyle = '#f59e0b';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.fillStyle = '#d1d5db';
    context.fillRect(enemy.x - 18, enemy.y - enemy.radius - 12, 36, 4);
    context.fillStyle = '#34d399';
    context.fillRect(enemy.x - 18, enemy.y - enemy.radius - 12, (enemy.hp / enemy.maxHp) * 36, 4);
  }
}

function drawBoss() {
  const boss = world.state.boss;
  if (!boss || !boss.active) return;

  context.save();
  context.translate(boss.x, boss.y);
  context.fillStyle = '#a78bfa';
  context.beginPath();
  context.arc(0, 0, boss.radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#ddd6fe';
  context.lineWidth = 3;
  context.stroke();
  context.restore();

  context.fillStyle = '#374151';
  context.fillRect(380, 28, 520, 12);
  context.fillStyle = '#a78bfa';
  context.fillRect(380, 28, (boss.hp / boss.maxHp) * 520, 12);
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
  context.fillText(`Deck ${p.deck}`, 60, 76);
  context.fillText(`Wave ${world.state.wave}`, 1160, 28);
  context.fillText(`Surge ${p.surgeCooldown <= 0 ? 'Ready' : `${Math.ceil(p.surgeCooldown)}ms`}`, 1160, 52);

  if (world.state.pendingUpgrades.length > 0) {
    const options = world.state.pendingUpgrades;
    const boxX = 252;
    const boxY = 180;
    context.fillStyle = 'rgba(15, 23, 42, 0.8)';
    context.fillRect(boxX, boxY, 776, 220);
    context.strokeStyle = '#cbd5e1';
    context.strokeRect(boxX, boxY, 776, 220);
    context.fillStyle = '#f8fafc';
    context.font = 'bold 24px sans-serif';
    context.fillText('Choose an upgrade', boxX + 24, boxY + 36);

    options.forEach((choice, index) => {
      const x = boxX + 24 + index * 240;
      const y = boxY + 60;
      context.fillStyle = '#0f172a';
      context.fillRect(x, y, 200, 120);
      context.strokeStyle = '#7dd3fc';
      context.strokeRect(x, y, 200, 120);
      context.fillStyle = '#f8fafc';
      context.fillText(choice.toUpperCase(), x + 18, y + 32);
      context.font = '14px sans-serif';
      context.fillText(choice === 'speed' ? '+20 move speed' : '', x + 18, y + 56);
      context.fillText(choice === 'fire' ? '+1.25 shots/sec' : '', x + 18, y + 72);
      context.fillText(choice === 'shield' ? '+25 max HP' : '', x + 18, y + 88);
      context.fillText(choice === 'surge' ? '+12 surge damage' : '', x + 18, y + 104);
    });
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

function render() {
  drawArena();
  drawProjectiles();
  drawPickups();
  drawBoss();
  drawEnemies();
  drawPlayer();
  drawHud();
  drawStatus();
}

function runGameLoop(timestamp: number) {
  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
  }
  const delta = Math.min(32, timestamp - state.lastTimestamp);
  state.lastTimestamp = timestamp;
  state.accumulator += delta;

  while (state.accumulator >= 1000 / 60) {
    const tick = world.state.tick;
    const input = getInput(tick);
    if (world.state.status === 'playing') {
      world.step(input);
    }
    state.accumulator -= 1000 / 60;
  }

  render();
  requestAnimationFrame(runGameLoop);
}

function handleKey(event: KeyboardEvent, isPressed: boolean) {
  const key = event.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') pressed.w = isPressed;
  if (key === 'a' || key === 'arrowleft') pressed.a = isPressed;
  if (key === 's' || key === 'arrowdown') pressed.s = isPressed;
  if (key === 'd' || key === 'arrowright') pressed.d = isPressed;
  if (key === ' ' && isPressed) {
    const tick = world.state.tick;
    const input = getInput(tick);
    input.surge = true;
    world.step(input);
  }
  if (key === 'r' && isPressed) {
    world.restart();
  }
  if ((key === '1' || key === '2') && isPressed) {
    world.setDeck(key === '1' ? 'bulwark' : 'tempest');
  }
}

window.addEventListener('keydown', (event) => handleKey(event, true));
window.addEventListener('keyup', (event) => handleKey(event, false));
window.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
});
window.addEventListener('mousedown', () => {
  mouse.down = true;
});
window.addEventListener('mouseup', () => {
  mouse.down = false;
});
window.addEventListener('click', (event) => {
  if (world.state.pendingUpgrades.length === 0) return;

  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const choices = world.state.pendingUpgrades;

  for (let index = 0; index < choices.length; index += 1) {
    const boxX = 276 + index * 240;
    const boxY = 240;
    if (x >= boxX && x <= boxX + 200 && y >= boxY && y <= boxY + 120) {
      world.applyUpgrade(choices[index]);
      return;
    }
  }
});

requestAnimationFrame(runGameLoop);
