// Playfield coordinates run left to right and from the back rail toward the player.
const rail = (ax, ay, bx, by) => ({ ax, ay, bx, by });

export const TABLE = {
  width: 2,
  height: 3.5,
  radius: 0.065,
  start: { x: 1.825, y: 3.22 },
  bumpers: [
    { x: 0.55, y: 0.78, r: 0.145, station: 'projects' },
    { x: 1.16, y: 0.95, r: 0.155, station: 'experience' },
    { x: 0.79, y: 1.47, r: 0.135, station: 'hobbies' },
  ],
  rails: [
    rail(0.07, 2.46, 0.07, 0.40),
    rail(0.07, 0.40, 0.36, 0.11),
    rail(0.36, 0.11, 1.54, 0.11),
    rail(1.54, 0.11, 1.94, 0.51),
    rail(1.94, 0.51, 1.94, 3.40),
    rail(1.70, 0.70, 1.70, 3.40),
    rail(0.07, 2.46, 0.38, 2.89),
    rail(1.70, 2.46, 1.41, 2.89),
  ],
  flippers: [
    { side: 'left', x: 0.38, y: 2.89, length: 0.385, r: 0.062, rest: 0.43, raised: -0.54 },
    { side: 'right', x: 1.41, y: 2.89, length: 0.385, r: 0.062, rest: Math.PI - 0.43, raised: Math.PI + 0.54 },
  ],
};

const STEP = 1 / 240;
const GRAVITY = 2.55;
const MAX_SPEED = 7.5;

function closestPoint(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const projection = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy);
  const t = Math.max(0, Math.min(1, projection));
  return { x: ax + t * dx, y: ay + t * dy };
}

// Resolve a contact in the moving surface's frame, allowing a swinging flipper to do work.
function contact(ball, point, radius, restitution, surfaceX = 0, surfaceY = 0, kick = 0) {
  const dx = ball.x - point.x;
  const dy = ball.y - point.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return 0;
  const nx = distance ? dx / distance : 0;
  const ny = distance ? dy / distance : -1;
  ball.x = point.x + nx * (radius + 0.0001);
  ball.y = point.y + ny * (radius + 0.0001);
  const approach = (ball.vx - surfaceX) * nx + (ball.vy - surfaceY) * ny;
  if (approach >= 0) return 0;
  const impulse = -(1 + restitution) * approach + kick;
  ball.vx += impulse * nx;
  ball.vy += impulse * ny;
  return -approach;
}

export function createPinball({ onEvent = () => {} } = {}) {
  const ball = { ...TABLE.start, vx: 0, vy: 0 };
  const flippers = Object.fromEntries(TABLE.flippers.map(f => [f.side, { ...f, angle: f.rest, held: false }]));
  const stats = { launches: 0, bumperHits: 0, drains: 0, highScore: 0 };
  const state = { mode: 'ready', ball, flippers, stats, score: 0, ballScore: 0, secret: false };
  const visited = new Set();
  const bumperTimes = new Map();
  let elapsed = 0;
  let accumulated = 0;
  let lastRailSound = -Infinity;

  function sound(name, strength = 1) { onEvent({ type: 'sound', name, strength }); }
  function mode(next) {
    state.mode = next;
    onEvent({ type: 'state', mode: next, stats: { ...stats } });
  }

  function launch() {
    if (state.mode !== 'ready') return false;
    stats.launches++;
    state.ballScore = 0;
    visited.clear();
    bumperTimes.clear();
    lastRailSound = -Infinity;
    Object.assign(ball, TABLE.start, { vx: 0, vy: -5.7 - (stats.launches % 3) * 0.17 });
    mode('playing');
    sound('launch');
    return true;
  }

  function flip(side, down) {
    const f = flippers[side];
    if (!f || state.mode === 'paused' || f.held === Boolean(down)) return;
    f.held = Boolean(down);
    if (down) sound('flip');
  }

  function drain() {
    stats.drains++;
    Object.assign(ball, TABLE.start, { vx: 0, vy: 0 });
    sound('drain');
    mode('ready');
  }

  function updateFlipper(f, dt) {
    const goal = f.held ? f.raised : f.rest;
    const turn = Math.sign(goal - f.angle) * Math.min(Math.abs(goal - f.angle), dt * (f.held ? 17 : 10));
    f.angle += turn;
    if (state.mode !== 'playing') return;
    const tipX = f.x + f.length * Math.cos(f.angle);
    const tipY = f.y + f.length * Math.sin(f.angle);
    const p = closestPoint(ball.x, ball.y, f.x, f.y, tipX, tipY);
    const omega = turn / dt;
    contact(ball, p, TABLE.radius + f.r, 0.48, -omega * (p.y - f.y), omega * (p.x - f.x));
  }

  function hit(bumper, speed) {
    if (elapsed - (bumperTimes.get(bumper) ?? -Infinity) < 0.14) return;
    bumperTimes.set(bumper, elapsed);
    stats.bumperHits++;
    state.ballScore += 100;
    state.score += 100;
    stats.highScore = Math.max(stats.highScore, state.ballScore);
    sound('bumper', Math.min(1, 0.4 + speed / 6));
    onEvent({ type: 'score', score: state.score, stats: { ...stats } });
    onEvent({ type: 'hit', station: bumper.station, score: state.score });
    visited.add(bumper.station);
    if (!state.secret && visited.size === TABLE.bumpers.length) {
      state.secret = true;
      onEvent({ type: 'secret' });
      sound('secret');
    }
  }

  function tick() {
    elapsed += STEP;
    if (state.mode === 'playing') {
      ball.vx *= 1 - STEP * 0.055;
      ball.vy = ball.vy * (1 - STEP * 0.055) + GRAVITY * STEP;
      ball.x += ball.vx * STEP;
      ball.y += ball.vy * STEP;
      for (const r of TABLE.rails) {
        const p = closestPoint(ball.x, ball.y, r.ax, r.ay, r.bx, r.by);
        const speed = contact(ball, p, TABLE.radius, 0.76);
        if (speed > 0.8 && elapsed - lastRailSound > 0.075) {
          lastRailSound = elapsed;
          sound('rail', Math.min(1, speed / 6));
        }
      }
      for (const bumper of TABLE.bumpers) {
        const speed = contact(ball, bumper, TABLE.radius + bumper.r, 0.88, 0, 0, 2.2);
        if (speed > 0) hit(bumper, speed);
      }
    }
    for (const f of Object.values(flippers)) updateFlipper(f, STEP);
    if (state.mode !== 'playing') return;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > MAX_SPEED) {
      ball.vx *= MAX_SPEED / speed;
      ball.vy *= MAX_SPEED / speed;
    }
    if (ball.y > TABLE.height + TABLE.radius || (ball.x > 1.7 && ball.y > TABLE.start.y && ball.vy > 0)) drain();
  }

  function update(seconds) {
    if (state.mode === 'paused' || !Number.isFinite(seconds) || seconds <= 0) return;
    accumulated += Math.min(seconds, 0.1);
    while (accumulated + 1e-10 >= STEP) {
      accumulated -= STEP;
      tick();
    }
  }

  function pause() {
    for (const f of Object.values(flippers)) f.held = false;
    if (state.mode === 'playing') mode('paused');
  }
  function resume() { if (state.mode === 'paused') mode('playing'); }

  return { state, launch, flip, update, pause, resume };
}
