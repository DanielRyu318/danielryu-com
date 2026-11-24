import { ROOM_GATES, ROOM_LAYOUT as layout, STATION_IDS, isReaderStation, returnSpring, stationTrack, surfaceY } from './room-layout.js';
import { railPath, tuple, xyz } from './room-path.js';
import { createPlayfield, ROOM_STEP } from './room-playfield.js';
import { roomRoute } from './room-routes.js';
import hardware from './room-mechanisms.json' with { type: 'json' };

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const launcher = layout.launcher;
const cradle = xyz(launcher.path[0]);
const destinations = new Set(['table', ...STATION_IDS]);

// Only a forward crossing inside the mouth, with the entire ball between the posts, operates a gate.
export function crossedRoomGate(before, after) {
  for (const [id, g] of Object.entries(ROOM_GATES)) {
    const [cx, cz] = g.center, [dx, dz] = g.direction;
    const previous = (before.x - cx) * dx + (before.z - cz) * dz;
    const current = (after.x - cx) * dx + (after.z - cz) * dz;
    if (previous >= 0 || current < 0) continue;
    const t = -previous / (current - previous);
    const x = before.x + (after.x - before.x) * t;
    const z = before.z + (after.z - before.z) * t;
    const y = before.y + (after.y - before.y) * t;
    if (Math.abs((x - cx) * dz - (z - cz) * dx) <= g.halfWidth - layout.ballRadius
      && Math.abs(y - surfaceY(z) - layout.ballRadius) < 0.038) return id;
  }
  return null;
}

export async function createRoomPhysics({ onEvent = () => {} } = {}) {
  const stats = { launches: 0, bumperHits: 0, drains: 0, highScore: 0 };
  const flippers = Object.fromEntries(layout.flippers.map(f => [f.side, { angle: f.rest, held: false }]));
  const mechanisms = {
    drops: Object.fromEntries(hardware.dropBank.targets.map(t => [t.id, 0])),
    rollovers: Object.fromEntries(hardware.rollovers.map(t => [t.id, 0])),
    spin: 0, captive: 0
  };
  const state = { mode: 'ready', station: 'table', ball: { ...cradle }, flippers, pull: 0, explore: false,
    mechanisms, score: 0, ballScore: 0, stats, travel: null, readerPage: null, secret: false,
    gates: Object.fromEntries(Object.keys(ROOM_GATES).map(id => [id, false])) };
  const lastImpact = new Map();
  const bells = new Set();
  const down = new Set();
  let spinVelocity = 0, rearmAt = Infinity;
  let bankAwardLit = false;
  let elapsed = 0, accumulated = 0, guide = null, trip = null, suspended = null;
  let disposed = false;
  const field = await createPlayfield(impact);

  function emit(type, fields = {}) { onEvent({ type, ...fields }); }
  function sound(name, strength = 1) { emit('sound', { name, strength }); }
  function mode(next) {
    state.mode = next;
    emit('state', { mode: next, station: state.station, stats: { ...stats } });
  }
  function score(points) {
    state.score += points;
    state.ballScore += points;
    stats.highScore = Math.max(stats.highScore, state.ballScore);
    emit('score', { score: state.score, stats: { ...stats } });
  }
  function selectReaderPage(page) {
    if (!isReaderStation(page) || state.readerPage === page) return;
    state.readerPage = page;
    emit('reader-select', { station: page });
  }
  function impact(tag) {
    if (elapsed - (lastImpact.get(tag.id) ?? -Infinity) < 0.14) return;
    lastImpact.set(tag.id, elapsed);
    if (tag.type === 'bumper') {
      const p = field.position();
      field.kick(p.x - tag.x, p.z - tag.z);
      stats.bumperHits++;
      bells.add(tag.id);
      score(100);
      emit('bumper', { id: tag.id });
      sound('bumper');
      if (!state.secret && bells.size === layout.bumpers.length) {
        state.secret = true;
        emit('secret');
        sound('secret');
      }
    } else if (tag.type === 'drop' && !down.has(tag.id)) {
      down.add(tag.id);
      field.setDropRaised(tag.id, false);
      score(125);
      sound('drop-target');
      if (down.size === hardware.dropBank.targets.length) {
        score(500);
        rearmAt = elapsed + 1.2;
        sound('secret', .65);
        bankAwardLit = true;
        selectReaderPage(layout.reader.contacts.bank);
      }
    } else if (tag.type === 'captive') {
      score(150);
      sound('captive');
    } else if (tag.type === 'spinner') {
      const speed = field.snapshot().velocity.z;
      spinVelocity = Math.sign(speed) * clamp(Math.abs(speed) * 24, 6, 34);
      score(75);
      sound('spinner', clamp(Math.abs(speed), .25));
    } else if (tag.type === 'rollover') {
      mechanisms.rollovers[tag.id] = 1;
      score(50);
      sound('rollover', .65);
      if (!bankAwardLit) selectReaderPage(layout.reader.contacts[tag.id]);
    } else if (tag.type === 'rail') {
      const v = field.snapshot().velocity;
      const speed = Math.hypot(v.x, v.z);
      if (speed > 0.28) sound('rail', clamp(speed / 2, 0.18));
    }
  }
  function place(p) { Object.assign(state.ball, p); }
  function setPull(fraction) {
    if (disposed || !Number.isFinite(fraction)) return false;
    if (['station', 'station-pulling'].includes(state.mode)) {
      const spring = returnSpring(state.station);
      if (!spring) return false;
      state.pull = clamp(fraction);
      place(xyz(spring.origin.map((v,i) => v + spring.direction[i] * spring.stroke * state.pull)));
      if (state.mode !== 'station-pulling') mode('station-pulling');
      return true;
    }
    if (!['ready', 'pulling'].includes(state.mode)) return false;
    state.pull = clamp(fraction);
    state.ball.z = cradle.z + launcher.pullDistance * state.pull;
    state.ball.y = cradle.y - layout.deck.slope * launcher.pullDistance * state.pull;
    if (state.mode !== 'pulling') mode('pulling');
    return true;
  }
  function cancelPull() {
    if (state.mode === 'station-pulling') {
      state.pull = 0;
      place(xyz(layout.anchors[state.station]));
      mode('station');
      return true;
    }
    if (state.mode !== 'pulling') return false;
    state.pull = 0;
    place(cradle);
    mode('ready');
    return true;
  }
  function release({ instant = false } = {}) {
    if (!disposed && ['station', 'station-pulling'].includes(state.mode)) {
      const power = state.mode === 'station' ? .72 : state.pull;
      if (!returnSpring(state.station)) return false;
      state.pull = 0;
      sound('launch', .5 + .45 * power);
      goTo('table', { instant, power });
      return true;
    }
    if (disposed || !['pulling', 'ready'].includes(state.mode)) return false;
    const power = state.mode === 'pulling' ? state.pull : 0.90;
    const path = railPath([tuple(state.ball), ...launcher.path]);
    guide = { path, progress: 0, speed: 1.48 + power * 2.2, power };
    state.pull = 0;
    stats.launches++;
    state.ballScore = 0;
    bells.clear();
    lastImpact.clear();
    resetBank();
    mode('playing');
    sound('launch', 0.56 + power * 0.44);
    return true;
  }
  function flip(side, down) {
    const f = flippers[side];
    if (disposed || !f || !['ready', 'playing', 'pulling'].includes(state.mode) || f.held === Boolean(down)) return false;
    f.held = Boolean(down);
    if (down) sound('flip');
    return true;
  }
  function setExplore(value) { state.explore = Boolean(value); }
  function resetBank() {
    for (const id of down) field.setDropRaised(id, true);
    down.clear();
    rearmAt = Infinity;
  }
  function stepMechanisms() {
    if (state.mode === 'playing' && elapsed >= rearmAt && hardware.dropBank.targets.every(t =>
      Math.hypot(t.x - state.ball.x, t.z - state.ball.z) > .075)) resetBank();
    for (const target of hardware.dropBank.targets) {
      const level = mechanisms.drops[target.id];
      mechanisms.drops[target.id] = clamp(level + ROOM_STEP * (down.has(target.id) ? 17 : -8));
    }
    for (const insert of hardware.rollovers) {
      mechanisms.rollovers[insert.id] = Math.max(0, mechanisms.rollovers[insert.id] - ROOM_STEP * .85);
    }
    mechanisms.spin += spinVelocity * ROOM_STEP;
    spinVelocity *= Math.exp(-3.0 * ROOM_STEP);
  }
  function freeze() {
    if (state.mode === 'pulling') cancelPull();
    for (const f of Object.values(flippers)) f.held = false;
    if (state.mode === 'playing') {
      suspended = { position: { ...state.ball }, guide, dynamic: guide ? null : field.snapshot() };
      guide = null;
    }
    field.park();
  }
  function arrive() {
    if (!trip) return;
    const finished = trip;
    if (finished.pulse > 0) flippers.left.held = false;
    trip = null;
    const to = finished.data.to;
    place(finished.path.at(1));
    state.station = to;
    state.travel = null;
    for (const id of Object.keys(state.gates)) state.gates[id] = false;
    if (finished.data.kind === 'spring-return') {
      suspended = null;
      const last = finished.path.at(1 - .012 / finished.path.length);
      const dx = state.ball.x - last.x, dz = state.ball.z - last.z;
      const speed = finished.exitSpeed / Math.hypot(dx, dz);
      const vx = dx * speed, vz = dz * speed;
      field.setBall(state.ball, {x:vx, y:-layout.deck.slope * vz, z:vz},
        {x:vz / layout.ballRadius, y:0, z:-vx / layout.ballRadius});
      mode('playing');
    } else {
      mode(to === 'table' ? suspended ? 'paused' : 'ready' : 'station');
      if (!finished.instant) sound('arrive');
    }
    emit('arrive', { station: to });
    finished.resolve(true);
  }
  function goTo(to, { instant = false, directGate = false, power = null } = {}) {
    if (disposed || !destinations.has(to)) return Promise.resolve(false);
    if (trip?.data.to === to) {
      const pending = trip.promise;
      if (instant) arrive();
      return pending;
    }
    if (state.station === to && !trip) return Promise.resolve(true);
    if (isReaderStation(to)) { bankAwardLit = false; state.readerPage = to; }
    const spring = power !== null;
    if (!spring && state.mode === 'station-pulling') cancelPull();
    const from = state.station;
    const atCradle = !trip && from === 'table' && ['ready','pulling'].includes(state.mode);
    const rollingGuide = guide;
    if (!trip && from === 'table' && state.mode !== 'paused') freeze();
    const plan = roomRoute({ from, to, position: state.ball, saved: suspended && tuple(suspended.position),
      directGate, spring, current: trip, atCradle, launcherGuide: rollingGuide });
    const {path, crossing, gateDistance, lipDistance} = plan;
    if (trip?.pulse > 0) flippers.left.held = false;
    trip?.resolve(false);
    guide = null;
    const kind = spring ? 'spring-return' : to === 'table' ? 'return' : 'station';
    const data = { from, to, kind, progress: 0,
      gateProgress: path.length ? gateDistance / path.length : 0,
      lipProgress: path.length ? lipDistance / path.length : 0,
      start: { ...state.ball }, position: state.ball, ahead: path.at(Math.min(1, .12 / path.length)), crossing };
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    const exitSpeed = spring ? .65 + power * 1.15 : 1.22;
    const velocity = suspended?.dynamic?.velocity;
    const entrySpeed = directGate && velocity ? clamp(Math.hypot(velocity.x, velocity.z), .65, 2.3) : 1.3;
    const readerReturn = spring && isReaderStation(from);
    const launchSpeed = readerReturn ? .14 + .12 * power : 1.02 + power * .86;
    const speed = spring ? launchSpeed : atCradle ? 2.55 : entrySpeed;
    trip = { ...plan, data, speed, distance: 0, exitSpeed, readerReturn, resolve, promise, instant,
      soundedGate: false, flipped: false, pulse: 0, startY: state.ball.y };
    state.travel = data;
    for (const id of Object.keys(state.gates)) state.gates[id] = id === stationTrack(to);
    mode('travel');
    if (instant || path.length < .0001) arrive();
    else if (atCradle) sound('launch', .62);
    else if (crossing) sound('gate', .55);
    return promise;
  }
  function resume() {
    if (state.mode !== 'paused' || !suspended) return false;
    const held = suspended;
    suspended = null;
    guide = held.guide;
    if (held.dynamic) field.setBall(held.dynamic.position, held.dynamic.velocity, held.dynamic.spin);
    place(held.position);
    mode('playing');
    return true;
  }
  function gateHit(id) {
    const destination = id === 'reader' ? state.readerPage : id;
    if (!destination) return;
    if (elapsed - (lastImpact.get(id) ?? -Infinity) < 0.42) return;
    lastImpact.set(id, elapsed);
    if (id === 'reader') bankAwardLit = false;
    score(250);
    emit('hit', { station: destination, score: state.score });
    if (state.explore) {
      goTo(destination, { directGate: true });
    } else {
      const [dx, dz] = ROOM_GATES[id].direction;
      const p = state.ball;
      field.setBall({ x: p.x - dx * 0.03, y: p.y, z: p.z - dz * 0.03 }, { x: -dx * 0.85, y: 0, z: -dz * 0.85 });
      sound('gate');
    }
  }
  function drain() {
    field.park();
    stats.drains++;
    place(cradle);
    mode('ready');
    sound('drain');
  }
  function advanceRail() {
    const { path, data, distance, gateDistance, flipperDistance } = trip;
    const remaining = path.length - distance;
    const fromCabinet = data.from === 'table' && data.to !== 'table' && !data.crossing;
    const onApproach = fromCabinet && distance < gateDistance;
    const spring = data.kind === 'spring-return';
    // A governed rail retains momentum over the lip, slows over the crest
    // and gains speed on the descent. Only the few centimetres of a locking
    // cup actively brake the ball. The table-return exit retains its speed.
    const cruise = data.crossing ? 1.31 : spring ? .84 + .075 * trip.exitSpeed : .94;
    const energy = cruise * cruise + 1.05 * (trip.startY - state.ball.y);
    let wanted = Math.sqrt(Math.max(.46, energy));
    if (onApproach) {
      // Let the automatic flipper shot carry its momentum to the mouth,
      // then feed it through the governor over the last few ball lengths.
      wanted = Math.min(2.22, Math.sqrt(wanted * wanted + 8.4 * (gateDistance - distance)));
    }
    if (trip.readerReturn) {
      // This short collector has an escapement at the cup. The release
      // rail then accelerates the ball to its exact playable exit speed.
      const governed = .4 + .05 * trip.exitSpeed;
      const runout = clamp(1 - remaining / .34);
      wanted = Math.sqrt(governed ** 2 + runout * (trip.exitSpeed ** 2 - governed ** 2));
    } else if (spring && remaining < .28) {
      const mix = remaining / .28;
      wanted = trip.exitSpeed + (wanted - trip.exitSpeed) * mix;
    } else if (!spring) {
      wanted = Math.min(wanted, Math.sqrt(.145 ** 2 + 7.4 * remaining));
    }
    trip.speed += clamp(wanted - trip.speed, -5.6 * ROOM_STEP, 4.5 * ROOM_STEP);
    trip.distance = Math.min(path.length, distance + trip.speed * ROOM_STEP);
    data.progress = trip.distance / path.length;
    place(path.at(data.progress));
    data.ahead = path.at(Math.min(1, data.progress + .13 / path.length));
    if (!trip.soundedGate && !data.crossing && trip.distance >= gateDistance) {
      trip.soundedGate = true;
      sound('gate', .7);
    }
    if (!trip.flipped && flipperDistance >= 0 && trip.distance >= flipperDistance - .045) {
      trip.flipped = true;
      flippers.left.held = true;
      trip.pulse = .085;
      sound('flip', .8);
    }
    if (trip.pulse > 0) {
      trip.pulse -= ROOM_STEP;
      if (trip.pulse <= 0) flippers.left.held = false;
    }
    if (trip.distance >= path.length) arrive();
  }
  function tick() {
    if (state.mode === 'playing') elapsed += ROOM_STEP;
    stepMechanisms();
    for (const f of layout.flippers) {
      const control = flippers[f.side], target = control.held ? f.raised : f.rest;
      control.angle += Math.sign(target - control.angle) * Math.min(Math.abs(target - control.angle), ROOM_STEP * (control.held ? 19 : 12));
    }
    if (trip) {
      advanceRail();
      return;
    }
    if (state.mode !== 'playing') return;
    if (guide) {
      guide.progress = Math.min(1, guide.progress + ROOM_STEP * guide.speed / guide.path.length);
      place(guide.path.at(guide.progress));
      if (guide.progress === 1) {
        const last = guide.path.at(0.995);
        const dx = state.ball.x - last.x, dz = state.ball.z - last.z;
        const speed = (0.85 + guide.power * 1.35) / Math.hypot(dx, dz);
        field.setBall(state.ball, { x: dx * speed, y: -0.11, z: dz * speed });
        guide = null;
      }
      return;
    }
    const previous = { ...state.ball };
    field.step(flippers);
    mechanisms.captive=field.captiveTravel();
    place(field.position());
    const gate = crossedRoomGate(previous, state.ball);
    if (gate) gateHit(gate);
    if (state.mode === 'playing' && (state.ball.z > 0.92 || state.ball.y < 0.80 || Math.abs(state.ball.x) > 0.59)) drain();
  }
  function update(seconds) {
    if (disposed || !Number.isFinite(seconds) || seconds <= 0) return;
    accumulated += Math.min(seconds, 0.10);
    while (accumulated + 1e-10 >= ROOM_STEP) { accumulated -= ROOM_STEP; tick(); }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    trip?.resolve(false);
    trip = null;
    field.dispose();
  }
  return { state, update, setPull, release, cancelPull, flip, goTo, resume, setExplore, dispose };
}
