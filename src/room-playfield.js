import RAPIER from '@dimforge/rapier3d-compat';
import { ROOM_LAYOUT as layout, surfaceY } from './room-layout.js';
import mechanisms from './room-mechanisms.json' with { type: 'json' };

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
  const drops = new Map();
  const bank = mechanisms.dropBank;
  const yaw = -Math.atan2(bank.tangent[1], bank.tangent[0]);
  for (const target of bank.targets) {
    const plate = collider.cuboid(bank.width / 2, bank.height / 2, bank.depth / 2)
      .setTranslation(target.x, surfaceY(target.z) + bank.height / 2, target.z)
      .setRotation(axesRotation(yaw)).setRestitution(0.54);
    drops.set(target.id, make(plate, { type: 'drop', id: target.id }));
  }
  const wheel = mechanisms.spinner;
  make(collider.cuboid(wheel.width / 2, wheel.axisHeight / 2, 0.003)
    .setTranslation(wheel.x, surfaceY(wheel.z) + wheel.axisHeight / 2, wheel.z)
    .setSensor(true), { type: 'spinner', id: wheel.id });
  for (const [x,z] of wheel.posts) {
    make(collider.cylinder(wheel.axisHeight / 2, wheel.postRadius)
      .setTranslation(x, surfaceY(z) + wheel.axisHeight / 2, z)
      .setRestitution(0.58), { type: 'rail', id: wheel.id + '-post-' + x });
  }
  for (const insert of mechanisms.rollovers) {
    make(collider.cylinder(0.013, insert.radius)
      .setTranslation(insert.x, surfaceY(insert.z) + 0.012, insert.z)
      .setSensor(true), { type: 'rollover', id: insert.id });
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
  const ballCollider = make(collider.ball(layout.ballRadius).setDensity(7800).setFriction(0.23).setCollisionGroups(0x0004ffff)
    .setRestitution(0.24).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), null, ball);
  ball.setEnabled(false);
  // The second steel ball slides on a one-axis joint. Its return spring,
  // rail travel and collision impulse are all solved on the same timestep.
  const captive = mechanisms.captive;
  const captiveY = surfaceY(captive.z) + captive.radius;
  const shoe = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(captive.x, captiveY, captive.z));
  const captiveBall = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(captive.x, captiveY, captive.z).setCcdEnabled(true).setCanSleep(false));
  make(collider.ball(captive.radius).setDensity(7800).setRestitution(.60).setFriction(0).setCollisionGroups(0x00020004),
    {type:'captive',id:'captive-ball'}, captiveBall);
  const slideAxis = {x:0,y:Math.sin(deckPitch),z:-Math.cos(deckPitch)};
  const slide = world.createImpulseJoint(RAPIER.JointData.prismatic(still,still,slideAxis),shoe,captiveBall,true);
  slide.setLimits(0,captive.stroke / Math.cos(deckPitch));
  slide.configureMotorPosition(0,100,7);
  for(const [x,z] of captive.posts){
    make(collider.cylinder(.024,captive.postRadius).setTranslation(x,surfaceY(z)+.024,z)
      .setRestitution(.55),{type:'rail',id:'captive-guard-'+x});
  }
  function captiveTravel(){
    return Math.max(0,Math.min(captive.stroke,captive.z-captiveBall.translation().z));
  }
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
  return { setBall, snapshot, step, kick, captiveTravel, setDropRaised: (id, raised) => drops.get(id)?.setEnabled(raised),
    position: () => copy(ball.translation()), park: () => ball.setEnabled(false),
    dispose() { events.free(); world.free(); } };
}
