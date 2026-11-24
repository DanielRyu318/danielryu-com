import { ROOM_LAYOUT as layout, surfaceY } from './room-layout.js';
import { railPath, tuple, xyz } from './room-path.js';
import { createPlayfield, ROOM_STEP } from './room-playfield.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const launcher = layout.launcher;
const cradle = xyz(launcher.path[0]);
const deckPoint = (x, z) => [x, surfaceY(z) + layout.ballRadius, z];
const junction = deckPoint(-0.115, 0.2);

// Only a forward crossing inside the mouth, with the entire ball between the posts, operates a gate.
export function crossedRoomGate(before, after) {
  for (const [id, g] of Object.entries(layout.gates)) {
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
  const state = { mode: 'ready', station: 'table', ball: { ...cradle }, flippers, pull: 0, explore: false,
    score: 0, ballScore: 0, stats, travel: null, secret: false, gates: { projects: false, experience: false } };
  const lastImpact = new Map();
  const bells = new Set();
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
    } else if (tag.type === 'rail') {
      const v = field.snapshot().velocity;
      const speed = Math.hypot(v.x, v.z);
      if (speed > 0.28) sound('rail', clamp(speed / 2, 0.18));
    }
  }
  function place(p) { Object.assign(state.ball, p); }
  function setPull(fraction) {
    if (disposed || !['ready', 'pulling'].includes(state.mode) || !Number.isFinite(fraction)) return false;
    state.pull = clamp(fraction);
    state.ball.z = cradle.z + launcher.pullDistance * state.pull;
    state.ball.y = cradle.y - layout.deck.slope * launcher.pullDistance * state.pull;
    if (state.mode !== 'pulling') mode('pulling');
    return true;
  }
  function cancelPull() {
    if (state.mode !== 'pulling') return false;
    state.pull = 0;
    place(cradle);
    mode('ready');
    return true;
  }
  function release() {
    if (disposed || !['pulling', 'ready'].includes(state.mode)) return false;
    const power = state.mode === 'pulling' ? state.pull : 0.90;
    const path = railPath([tuple(state.ball), ...launcher.path]);
    guide = { path, progress: 0, speed: 1.48 + power * 2.2, power };
    state.pull = 0;
    stats.launches++;
    state.ballScore = 0;
    bells.clear();
    lastImpact.clear();
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
  function freeze() {
    if (state.mode === 'pulling') cancelPull();
    for (const f of Object.values(flippers)) f.held = false;
    if (state.mode === 'playing') {
      suspended = { position: { ...state.ball }, guide, dynamic: guide ? null : field.snapshot() };
      guide = null;
    }
    field.park();
  }
  const stationRoute = id => layout.routes[id] || [layout.anchors[id]];
  function route(to, directGate, crossing) {
    const from = state.station;
    if (crossing) return railPath(from === 'projects' ? layout.crossing : [...layout.crossing].reverse());
    const points = [tuple(state.ball)];
    if (from !== 'table' && !trip) {
      points.push(...[...stationRoute(from)].reverse().slice(1));
      points.push(...[...(layout.approaches[from] || [])].reverse().map(([x,z]) => deckPoint(x,z)));
    }
    if (to === 'table') {
      points.push(junction, tuple(suspended?.position || cradle));
    } else {
      if (!directGate) {
        if (state.mode === 'ready' && from === 'table' && !trip) points.push(...launcher.path.slice(1));
        points.push(junction);
        points.push(...(layout.approaches[to] || []).map(([x,z]) => deckPoint(x,z)));
      }
      points.push(...stationRoute(to));
    }
    return railPath(points);
  }
  function arrive() {
    if (!trip) return;
    const finished = trip;
    trip = null;
    const to = finished.data.to;
    place(finished.path.at(1));
    state.station = to;
    state.travel = null;
    state.gates.projects = state.gates.experience = false;
    mode(to === 'table' ? suspended ? 'paused' : 'ready' : 'station');
    if (!finished.instant) sound('arrive');
    emit('arrive', { station: to });
    finished.resolve(true);
  }
  function goTo(to, { instant = false, directGate = false } = {}) {
    if (disposed || !Object.hasOwn(layout.anchors, to)) return Promise.resolve(false);
    if (trip?.data.to === to) {
      const pending = trip.promise;
      if (instant) arrive();
      return pending;
    }
    if (state.station === to && !trip) return Promise.resolve(true);
    if (!trip && state.station === 'table' && state.mode !== 'paused') freeze();
    const crossing = !trip && Boolean(layout.routes[state.station] && layout.routes[to]);
    const path = route(to, directGate, crossing);
    trip?.resolve(false);
    guide = null;
    const from = state.station;
    const lip = crossing ? 0.07 : layout.routes[to] ? path.firstProgress(([x]) => to === 'projects' ? x < -0.52 : x > 0.52) : 0.12;
    const data = { from, to, kind: to === 'table' ? 'return' : 'station', progress: 0, lipProgress: lip,
      start: { ...state.ball }, position: state.ball, crossing };
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    trip = { data, path, elapsed: 0, duration: clamp(path.length / 1.23, 0.85, 2.85), resolve, promise, instant };
    state.travel = data;
    state.gates.projects = to === 'projects';
    state.gates.experience = to === 'experience';
    mode('travel');
    if (instant) arrive();
    else sound('gate');
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
    if (elapsed - (lastImpact.get(id) ?? -Infinity) < 0.42) return;
    lastImpact.set(id, elapsed);
    score(250);
    emit('hit', { station: id, score: state.score });
    if (state.explore) {
      goTo(id, { directGate: true });
    } else {
      const g = layout.gates[id], [dx, dz] = g.direction;
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
  function tick() {
    elapsed += ROOM_STEP;
    for (const f of layout.flippers) {
      const control = flippers[f.side], target = control.held ? f.raised : f.rest;
      control.angle += Math.sign(target - control.angle) * Math.min(Math.abs(target - control.angle), ROOM_STEP * (control.held ? 19 : 12));
    }
    if (trip) {
      trip.elapsed += ROOM_STEP;
      const t = Math.min(1, trip.elapsed / trip.duration);
      const progress = t * t * (3 - 2 * t);
      trip.data.progress = progress;
      place(trip.path.at(progress));
      if (t === 1) arrive();
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
