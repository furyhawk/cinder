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

const world = createWorld('dot-seed');
let tick = 0;

function draw() {
  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(world.state.dot.x + 640, world.state.dot.y + 360, 8, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#9ca3af';
  context.font = '16px sans-serif';
  context.fillText(`tick: ${world.state.tick}`, 16, 28);
  context.fillText('entities: 1', 16, 52);
}

function frame() {
  const input = createInputFrame(tick, {
    moveX: Math.sin(tick / 8) * 0.8,
    moveY: Math.cos(tick / 10) * 0.8,
  });

  world.step(input);
  draw();
  tick += 1;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
