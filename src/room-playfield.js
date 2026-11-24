import RAPIER from '@dimforge/rapier3d-compat';
import { ROOM_LAYOUT as layout, surfaceY } from './room-layout.js';

export const ROOM_STEP = 1 / 180;
const deckPitch = Math.atan(layout.deck.slope);
let boot;
function axesRotation(yaw) {
  const a = Math.sin(deckPitch / 2), b = Math.cos(deckPitch / 2);
  const c = Math.sin(yaw / 2), d = Math.cos(yaw / 2);
  return { x: a * d, y: b * c, z: a * c, w: b * d };
}
const copy = ({ x, y, z }) => ({ x, y, z });
const still = { x: 0, y: 0, z: 0 };

export async function createPlayfield(onImpact) {
  boot ??= RAPIER.init();
  await boot;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = ROOM_STEP;
  world.numSolverIterations = 6;
  world.maxCcdSubsteps = 3;
  const events = new RAPIER.EventQueue(true);
  const tags = new Map();
  const make = (desc, tag, body) => {
    const c = world.createCollider(desc, body);
    if (tag) tags.set(c.handle, tag);
    return c;
  };
  const collider = RAPIER.ColliderDesc;
  make(collider.cuboid(0.55, 0.038, 0.91)
    .setRotation(axesRotation(0)).setTranslation(0, layout.deck.height - 0.038, 0)
    .setFriction(0.15).setRestitution(0.03));
  for (const rail of layout.rails) {
    for (let i = 1; i < rail.points.length; i++) {
      const [ax, az] = rail.points[i - 1], [bx, bz] = rail.points[i];
      const z = (az + bz) / 2;
      make(collider.cuboid(rail.radius, 0.040, Math.hypot(bx - ax, bz - az) / 2)
        .setTranslation((ax + bx) / 2, surfaceY(z) + 0.03, z)
        .setRotation(axesRotation(Math.atan2(bx - ax, bz - az))).setRestitution(0.68)
        .setFriction(0.09), { type: 'rail', id: rail.id });
    }
    for (const [x,z] of rail.points) {
      make(collider.cylinder(0.04, rail.radius).setTranslation(x, surfaceY(z) + 0.03, z)
        .setRestitution(0.68).setFriction(0.09), { type: 'rail', id: rail.id });
    }
  }
  for (const bumper of layout.bumpers) {
    make(collider.cylinder(0.044, bumper.radius).setTranslation(bumper.x, surfaceY(bumper.z) + 0.032, bumper.z)
      .setRestitution(0.8).setFriction(0.12), { type: 'bumper', ...bumper });
  }
  const bats = {};
  for (const f of layout.flippers) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(f.x, surfaceY(f.z) + 0.025, f.z).setRotation(axesRotation(-f.rest)));
    const tag = { type: 'flipper', id: f.side };
    make(collider.cuboid(f.length / 2, 0.024, f.radius).setTranslation(f.length / 2, 0, 0).setRestitution(0.45), tag, body);
    for (const x of [0, f.length]) {
      make(collider.cylinder(0.024, f.radius).setTranslation(x, 0, 0).setRestitution(0.45), tag, body);
    }
    bats[f.side] = body;
  }
  const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setCcdEnabled(true).setCanSleep(false).setLinearDamping(0.045).setAngularDamping(0.22));
  const ballCollider = make(collider.ball(layout.ballRadius).setDensity(7800).setFriction(0.23)
    .setRestitution(0.24).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), null, ball);
  ball.setEnabled(false);
  function setBall(position, velocity = still, spin = still) {
    ball.setEnabled(true);
    ball.setTranslation(position, true);
    ball.setLinvel(velocity, true);
    ball.setAngvel(spin, true);
  }
  function snapshot() {
    return { position: copy(ball.translation()), velocity: copy(ball.linvel()), spin: copy(ball.angvel()) };
  }
  function step(flippers) {
    for (const [side, body] of Object.entries(bats)) body.setNextKinematicRotation(axesRotation(-flippers[side].angle));
    world.step(events);
    events.drainCollisionEvents((a, b, started) => {
      if (!started || !ball.isEnabled()) return;
      const tag = tags.get(a === ballCollider.handle ? b : b === ballCollider.handle ? a : -1);
      if (tag) onImpact?.(tag);
    });
  }
  function kick(dx, dz) {
    const v = ball.linvel();
    const scale = Math.hypot(dx, dz);
    if (scale) ball.setLinvel({ x: v.x + dx * 0.82 / scale, y: v.y, z: v.z + dz * 0.82 / scale }, true);
  }
  return { setBall, snapshot, step, kick, position: () => copy(ball.translation()), park: () => ball.setEnabled(false),
    dispose() { events.free(); world.free(); } };
}
