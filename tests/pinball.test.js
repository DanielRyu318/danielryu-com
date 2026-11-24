import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinball, TABLE } from '../src/pinball.js';

function strike(game, bumper) {
  Object.assign(game.state.ball, { x: bumper.x, y: bumper.y - bumper.r - TABLE.radius - 0.001, vx: 0, vy: 1.8 });
  game.update(1 / 120);
}

test('a launch leaves the right lane, scores in free play, and returns an unattended ball', () => {
  const events = [];
  const game = createPinball({ onEvent: e => events.push(e) });
  assert.equal(game.launch(), true);
  assert.equal(game.launch(), false);
  let reachedMainField = false;
  for (let frame = 0; frame < 900 && game.state.mode === 'playing'; frame++) {
    game.update(1 / 60);
    reachedMainField ||= game.state.ball.x < 1.5;
  }
  assert.ok(reachedMainField);
  assert.equal(game.state.mode, 'ready');
  assert.ok(game.state.score > 0);
  assert.equal(game.state.stats.drains, 1);
  assert.equal(game.state.stats.launches, 1);
  assert.ok(events.some(e => e.type === 'hit' && e.station === 'projects'));
  assert.deepEqual(game.state.ball, { ...TABLE.start, vx: 0, vy: 0 });
  assert.equal(game.launch(), true);
  assert.equal(game.state.ballScore, 0);
  assert.equal(game.state.stats.launches, 2);
});

test('both flippers kick an incoming ball toward the back of the table', () => {
  for (const side of ['left', 'right']) {
    const game = createPinball();
    game.launch();
    const f = game.state.flippers[side];
    const arm = 0.28;
    Object.assign(game.state.ball, {
      x: f.x + Math.cos(f.angle) * arm,
      y: f.y + Math.sin(f.angle) * arm - 0.16,
      vx: 0, vy: 0.2,
    });
    game.flip(side, true);
    game.update(0.05);
    assert.ok(game.state.ball.vy < -1.5, `${side} flipper imparted upward velocity`);
    game.flip(side, false);
    game.update(0.10);
    assert.equal(f.angle, f.rest);
  }
});

test('three distinct bumper stations in a single ball unlock the secret only once', () => {
  const events = [];
  const game = createPinball({ onEvent: e => events.push(e) });
  game.launch();
  for (const bumper of TABLE.bumpers) strike(game, bumper);
  assert.equal(game.state.secret, true);
  assert.equal(game.state.score, 300);
  assert.equal(game.state.stats.highScore, 300);
  assert.equal(game.state.stats.bumperHits, 3);
  assert.equal(events.filter(e => e.type === 'secret').length, 1);
  game.update(0.1);
  game.update(0.1);
  strike(game, TABLE.bumpers[0]);
  assert.equal(events.filter(e => e.type === 'secret').length, 1);
});

test('visiting a station freezes the ball and its state until deliberate resume', () => {
  const game = createPinball();
  game.launch();
  game.update(0.1);
  game.flip('left', true);
  game.pause();
  const ball = { ...game.state.ball };
  game.update(20);
  game.flip('right', true);
  assert.equal(game.launch(), false);
  assert.equal(game.state.mode, 'paused');
  assert.equal(game.state.flippers.left.held, false);
  assert.equal(game.state.flippers.right.held, false);
  assert.deepEqual(game.state.ball, ball);
  game.resume();
  game.update(1 / 60);
  assert.notDeepEqual(game.state.ball, ball);
  assert.equal(game.state.stats.launches, 1);
});

test('render frame rate does not change a launch trajectory', () => {
  function sample(fps) {
    const game = createPinball();
    game.launch();
    for (let frame = 0; frame < 2 * fps; frame++) game.update(1 / fps);
    return { ...game.state.ball, score: game.state.score };
  }
  assert.deepEqual(sample(30), sample(144));
});
