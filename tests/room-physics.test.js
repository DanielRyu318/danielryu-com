import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_LAYOUT as layout, returnSpring, surfaceY } from '../src/room-layout.js';
import hardware from '../src/room-mechanisms.json' with { type: 'json' };
import { createPlayfield, ROOM_STEP } from '../src/room-playfield.js';
import { createRoomPhysics, crossedRoomGate } from '../src/room-physics.js';
import { railPath, xyz } from '../src/room-path.js';
import { roomRoute } from '../src/room-routes.js';

async function machine(t, onEvent) {
  const game = await createRoomPhysics({ onEvent });
  t.after(() => game.dispose());
  return game;
}
function frames(game, count, control = () => {}) {
  for (let i = 0; i < count; i++) { control(); game.update(1 / 60); }
}
function playFlippers(game) {
  const b = game.state.ball;
  if (b.z > 0.46 && b.z < 0.72) game.flip(b.x < 0 ? 'left' : 'right', b.z > 0.60 && b.z < 0.72);
  else { game.flip('left', false); game.flip('right', false); }
}
function close(a, b, delta = 0.0002) { assert.ok(Math.abs(a - b) < delta, `${a} should equal ${b}`); }

function finishRailTrip(game) {
  let ticks = 0;
  while (game.state.travel && ticks < 1800) {
    ticks++;
    game.update(ROOM_STEP);
  }
  assert.equal(game.state.travel, null, 'ball must clear the rail within ten seconds');
  return ticks * ROOM_STEP;
}

test('launcher and Experience have more than a ball diameter of vertical clearance at the crossing', () => {
  const launch = railPath(layout.launcher.path), exit = railPath(layout.routes.experience);
  const launchPoint = launch.at(launch.firstProgress(p => p[2] < -0.746));
  const exitPoint = exit.at(exit.firstProgress(p => p[0] > launchPoint.x));
  assert.ok(Math.hypot(launchPoint.x - exitPoint.x, launchPoint.z - exitPoint.z) < 0.015);
  assert.ok(launchPoint.y - exitPoint.y > 2 * layout.ballRadius + 0.05);
  assert.equal(crossedRoomGate({ x:0.25, y:1.16, z:-0.57 }, { x:0.27, y:1.16, z:-0.62 }), null);
});

test('drag is reversible; a strong release clears the launch bridge before a light release', async t => {
  const light = await machine(t), strong = await machine(t);
  strong.setPull(1);
  close(strong.state.ball.z, layout.launcher.z + layout.launcher.pullDistance);
  assert.equal(strong.cancelPull(), true);
  assert.equal(strong.state.stats.launches, 0);
  assert.equal(strong.state.mode, 'ready');
  close(strong.state.ball.z, layout.launcher.z);
  light.setPull(0.15); strong.setPull(1);
  light.release(); strong.release();
  assert.equal(strong.release(), false);
  frames(light, 18); frames(strong, 18);
  assert.ok(strong.state.ball.z < light.state.ball.z - 0.18);
  frames(light, 1800); frames(strong, 1800);
  for (const game of [light, strong]) {
    assert.equal(game.state.mode, 'ready');
    assert.equal(game.state.stats.drains, 1);
    assert.equal(game.state.stats.launches, 1);
    close(game.state.ball.z, layout.launcher.z);
  }
});

test('Rapier kinematic flippers impart upward velocity to an incoming sphere on both sides', async () => {
  for (const f of layout.flippers) {
    const hits = [];
    const world = await createPlayfield(tag => hits.push(tag.type));
    try {
      const controls = Object.fromEntries(layout.flippers.map(f => [f.side, { angle:f.rest }]));
      const x = f.x + Math.cos(f.rest) * 0.11, z = f.z + Math.sin(f.rest) * 0.11 - 0.063;
      world.setBall({ x, y:surfaceY(z) + layout.ballRadius, z }, { x:0, y:0, z:0.03 });
      for (let i = 0; i < 10; i++) {
        const arm = controls[f.side];
        arm.angle += Math.sign(f.raised - arm.angle) * Math.min(Math.abs(f.raised - arm.angle), 19 * ROOM_STEP);
        world.step(controls);
      }
      assert.ok(hits.includes('flipper'));
      assert.ok(world.snapshot().velocity.z < -1.4);
    } finally { world.dispose(); }
  }
});

test('the two mouths distinguish front, back, outside and elevated trajectories', () => {
  for (const [id, g] of Object.entries(layout.gates)) {
    const [dx, dz] = g.direction, [x, z] = g.center;
    const point = (t, offset, height) => ({ x:x + t * dx + dz * offset,
      y:surfaceY(z + t * dz - dx * offset) + layout.ballRadius + height, z:z + t * dz - dx * offset });
    assert.equal(crossedRoomGate(point(-0.02,0,0), point(0.02,0,0)), id);
    assert.equal(crossedRoomGate(point(0.02,0,0), point(-0.02,0,0)), null);
    assert.equal(crossedRoomGate(point(-0.02,g.halfWidth,0), point(0.02,g.halfWidth,0)), null);
    assert.equal(crossedRoomGate(point(-0.02,0,0.13), point(0.02,0,0.13)), null);
  }
});

test('a real flipper run can hit both gated shots during free play and only lights invitations', async t => {
  const destinations = new Set(), events = [];
  const game = await machine(t, e => { if (e.type === 'hit') destinations.add(e.station); events.push(e.type); });
  game.setPull(0.6); game.release();
  frames(game, 1500, () => playFlippers(game));
  assert.deepEqual([...destinations].sort(), ['experience', 'projects']);
  assert.equal(game.state.station, 'table');
  assert.ok(!events.includes('arrive'));
  assert.ok(game.state.score >= 500);
});

test('in Explore a complete shot goes through its switch and locks at the destination', async t => {
  const game = await machine(t);
  game.setExplore(true);
  game.setPull(0.6); game.release();
  for (let i = 0; i < 1500 && game.state.mode !== 'travel'; i++) {
    playFlippers(game);
    game.update(1 / 60);
  }
  assert.equal(game.state.mode, 'travel');
  const id = game.state.travel.to;
  assert.ok(layout.gates[id]);
  assert.equal(game.state.gates[id], true);
  assert.ok(game.state.travel.lipProgress > 0 && game.state.travel.lipProgress < 1);
  frames(game, 240);
  assert.equal(game.state.mode, 'station');
  assert.equal(game.state.station, id);
  const [x, y, z] = layout.anchors[id];
  assert.deepEqual(game.state.ball, {x,y,z});
});

test('station visits suspend and restore the exact free-play trajectory, including launch guides', async t => {
  for (const framesInPlay of [12, 60]) {
    const a = await machine(t), b = await machine(t);
    for (const game of [a,b]) { game.setPull(0.6); game.release(); frames(game, framesInPlay); }
    const prior = {...a.state.ball};
    await a.goTo('projects', {instant:true});
    await a.goTo('experience', {instant:true});
    await a.goTo('table', {instant:true});
    assert.equal(a.state.mode, 'paused');
    frames(a, 30);
    assert.deepEqual(a.state.ball, prior);
    assert.equal(a.resume(), true);
    frames(a, 12); frames(b, 12);
    for (const k of ['x','y','z']) close(a.state.ball[k], b.state.ball[k], 0.004);
    assert.equal(a.state.stats.launches, 1);
  }
});

test('redirects settle old navigation promises and Back returns an unplayed ball to its spring', async t => {
  const game = await machine(t);
  const original = game.goTo('projects');
  frames(game, 20);
  const redirect = game.goTo('experience');
  assert.equal(await original, false);
  finishRailTrip(game);
  assert.equal(await redirect, true);
  assert.equal(game.state.station, 'experience');
  await game.goTo('table', {instant:true});
  assert.equal(game.state.mode, 'ready');
  assert.equal(game.state.stats.launches, 0);
});

test('interrupting the automatic stroke releases the flipper before the next ball', async t => {
  const game = await machine(t);
  const interrupted = game.goTo('experience');
  for (let ticks = 0; ticks < 900 && !game.state.flippers.left.held; ticks++) game.update(ROOM_STEP);
  assert.equal(game.state.flippers.left.held, true);
  await game.goTo('table', { instant:true });
  assert.equal(await interrupted, false);
  frames(game, 15);
  assert.equal(game.state.flippers.left.held, false);
  assert.equal(game.state.flippers.left.angle, layout.flippers[0].rest);
});

test('the rear rail directly connects both desks in either direction', async t => {
  const game = await machine(t);
  await game.goTo('projects', {instant:true});
  for (const destination of ['experience','projects']) {
    const journey = game.goTo(destination);
    assert.equal(game.state.travel.crossing, true);
    let ticks = 0;
    while (game.state.travel.progress < 0.49 && ticks < 1800) { game.update(ROOM_STEP); ticks++; }
    assert.ok(game.state.ball.z < -1.20);
    assert.ok(Math.abs(game.state.ball.x) < 0.20);
    const seconds = ticks * ROOM_STEP + finishRailTrip(game);
    assert.ok(seconds > 2.7 && seconds < 3.3, `crossing took ${seconds}s`);
    assert.equal(await journey, true);
    assert.equal(game.state.station, destination);
  }
});

test('a launch produces the same Rapier trajectory at 30 and 144 render frames per second', async t => {
  const a = await machine(t), b = await machine(t);
  for (const [game, fps] of [[a,30],[b,144]]) {
    game.setPull(0.75); game.release();
    for (let i = 0; i < fps * 2; i++) game.update(1 / fps);
  }
  assert.deepEqual(a.state.ball, b.state.ball);
  assert.equal(a.state.score, b.state.score);
});

test('automatic shots enter both gates on the exposed wire tangent and continue along the modeled track', () => {
  for (const id of Object.keys(layout.gates)) {
    const { path, gateDistance, lipDistance } = roomRoute({
      from: 'table', to: id, position: xyz(layout.launcher.path[0]), atCradle: true
    });
    const wire = railPath(layout.routes[id]);
    assert.ok(gateDistance > 0 && gateDistance < lipDistance && lipDistance < path.length);
    const atGate = path.at(gateDistance / path.length);
    const previous = path.at((gateDistance - .007) / path.length);
    const next = path.at((gateDistance + .007) / path.length);
    const [dx, dz] = layout.gates[id].direction;
    for (const [start, end] of [[previous, atGate], [atGate, next]]) {
      const x = end.x - start.x, z = end.z - start.z;
      assert.ok((x * dx + z * dz) / Math.hypot(x, z) > .96);
    }
    for (const fraction of [0, .1, .4, .9, 1]) {
      const actual = path.at((gateDistance + fraction * wire.length) / path.length);
      const expected = wire.at(fraction);
      for (const axis of ['x','y','z']) close(actual[axis], expected[axis], 1e-8);
    }
  }
});

test('the local plunger at each station cancels cleanly and shoots a live ball through its own entrance', async t => {
  for (const id of Object.keys(layout.gates)) {
    const spring = returnSpring(id);
    const runs = [];
    for (const power of [.1, 1]) {
      const game = await machine(t);
      await game.goTo(id, { instant: true });
      game.setPull(.8);
      assert.equal(game.state.mode, 'station-pulling');
      const pulled = spring.origin.map((value, i) => value + spring.direction[i] * spring.stroke * .8);
      assert.deepEqual(game.state.ball, xyz(pulled));
      assert.equal(game.cancelPull(), true);
      assert.deepEqual(game.state.ball, xyz(spring.origin));
      assert.equal(game.state.mode, 'station');
      game.setPull(power);
      assert.equal(game.release(), true);
      assert.equal(game.state.travel.kind, 'spring-return');
      assert.equal(game.state.travel.from, id);
      assert.ok(game.state.travel.lipProgress < game.state.travel.gateProgress);
      const seconds = finishRailTrip(game);
      assert.ok(seconds > 1.3 && seconds < 2.35, `${id} return took ${seconds}s`);
      assert.equal(game.state.mode, 'playing');
      assert.equal(game.state.station, 'table');
      assert.equal(game.resume(), false);
      const exit = { ...game.state.ball };
      const { direction: [dx,dz], center: [x,z] } = layout.gates[id];
      assert.ok((exit.x - x) * dx + (exit.z - z) * dz < -layout.ballRadius);
      game.update(ROOM_STEP);
      const vx = (game.state.ball.x - exit.x) / ROOM_STEP;
      const vz = (game.state.ball.z - exit.z) / ROOM_STEP;
      assert.ok(vx * dx + vz * dz < -.6, 'ball rolls away from the pocket toward the flippers');
      runs.push({ seconds, speed: Math.hypot(vx, vz) });
    }
    assert.ok(runs[1].seconds < runs[0].seconds);
    assert.ok(runs[1].speed > 2 * runs[0].speed);
  }
});

test('a reduced-motion spring return starts at the same playable exit and velocity as a full ride', async t => {
  for (const id of Object.keys(layout.gates)) {
    const direct = await machine(t), animated = await machine(t);
    for (const game of [direct, animated]) {
      await game.goTo(id, { instant: true });
      game.setPull(.72);
      game.release({ instant: game === direct });
    }
    assert.equal(direct.state.station, 'table');
    assert.equal(direct.state.mode, 'playing');
    finishRailTrip(animated);
    assert.deepEqual(direct.state.ball, animated.state.ball);
    frames(direct, 12);
    frames(animated, 12);
    for (const axis of ['x','y','z']) close(direct.state.ball[axis], animated.state.ball[axis]);
  }
});

test('shots can drop the complete bank, earn its bonus, rearm it, and light both rollover lenses', async t => {
  const scoreSteps = [], sounds = new Set();
  let lastScore = 0;
  const game = await machine(t, e => {
    if (e.type === 'sound') sounds.add(e.name);
    if (e.type === 'score') {
      scoreSteps.push(e.score - lastScore);
      lastScore = e.score;
    }
  });
  game.setPull(.6);
  game.release();
  const lamps = new Set();
  let fullyDown = false, rearmed = false;
  for (let frame = 0; frame < 2000 && game.state.mode === 'playing'; frame++) {
    playFlippers(game);
    game.update(1 / 60);
    const { drops, rollovers } = game.state.mechanisms;
    if (hardware.dropBank.targets.every(t => drops[t.id] === 1)) fullyDown = true;
    if (fullyDown && Object.values(drops).every(level => level === 0)) rearmed = true;
    for (const light of hardware.rollovers) if (rollovers[light.id] > .5) lamps.add(light.id);
    if (rearmed && lamps.size === hardware.rollovers.length) break;
  }
  assert.ok(fullyDown && rearmed);
  assert.ok(scoreSteps.includes(500));
  assert.equal(lamps.size, hardware.rollovers.length);
  assert.ok(sounds.has('drop-target') && sounds.has('rollover'));
});

test('a ball through the spinner sets the rotor in motion and awards its own points', async t => {
  let previousScore = 0, increment = 0, spinnerAward;
  const game = await machine(t, event => {
    if (event.type === 'score') {
      increment = event.score - previousScore;
      previousScore = event.score;
    }
    if (event.name === 'spinner') spinnerAward = increment;
  });
  game.setPull(.87);
  game.release();
  for (let frame = 0; frame < 1500 && !spinnerAward; frame++) {
    const { x, z } = game.state.ball;
    for (const side of ['left','right']) {
      game.flip(side, (side === 'left') === (x < 0) && z > .595 && z < .725);
    }
    game.update(1 / 60);
  }
  assert.equal(spinnerAward, 75);
  const angle = game.state.mechanisms.spin;
  game.update(1 / 60);
  assert.ok(Math.abs(game.state.mechanisms.spin - angle) > .03);
});
