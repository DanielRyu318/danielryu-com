import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import { isReaderStation } from './room-layout.js';

const v = (x, y, z) => new Vector3(x, y, z);
const blend = MathUtils.smoothstep;
const pose = (eye, look, fov, near = .035) => ({ eye, look, fov, near });

// Fit the cabinet itself. The outgoing room rails can leave the frame.
// Use the front feet and the backbox separately: the cabinet is not a solid box.
const cabinetExtents = [
  [-.56, .02, .85], [.56, .02, .85],
  [-.58, .97, .98], [.58, .97, .98],
  [-.58, 1.08, -.96], [.58, 1.08, -.96],
  [-.16, 1.23, -.91], [.16, 1.23, -.91],
  [-.46, 1.60, -1.04], [.46, 1.60, -1.04],
].map(point => v(...point));

function desktopTable(aspect) {
  // Keep the optical axis on the longitudinal centreline. A longer lens
  // preserves the maker's rectangular layout from the player's position.
  const eye = v(0, 3.60, 3.34);
  const look = v(0, .83, 0);
  const forward = look.clone().sub(eye).normalize();
  const right = forward.clone().cross(v(0, 1, 0)).normalize();
  const up = right.clone().cross(forward);
  const extents = cabinetExtents.map(point => {
    const offset = point.clone().sub(eye);
    const depth = offset.dot(forward);
    return { x: offset.dot(right) / depth, y: offset.dot(up) / depth };
  });
  const maxY = Math.max(...extents.map(p => p.y));
  const minY = Math.min(...extents.map(p => p.y));
  const center = Math.atan((maxY + minY) / 2);
  look.copy(eye).addScaledVector(forward, 2.8).addScaledVector(up, Math.tan(center) * 2.8);
  const halfHeight = Math.max((maxY - minY) / 1.83, ...extents.map(p => Math.abs(p.x) / (.88 * aspect)));
  return pose(eye, look, MathUtils.radToDeg(2 * Math.atan(halfHeight)), 2.48);
}

export function cameraPoses(aspect) {
  const portrait = aspect < .8;
  const focus = v(0, 1, -.04);
  const pitch = Math.asin(MathUtils.clamp(.58 / aspect, .25, .97)) - .035;
  const offset = v(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(3.75);
  const fittedPortrait = MathUtils.radToDeg(2 * Math.atan(Math.max(1.42 / aspect, 1.87 * Math.sin(pitch) + .24) / 7.5));
  const readerLook = v(-.145, 1.315, -.965);
  const readerDistance = Math.max(1.30, 1.24 / aspect);
  const readerEye = readerLook.clone().addScaledVector(v(0,.45,.893),readerDistance);
  const readerFov = MathUtils.radToDeg(2 * Math.atan(Math.max(.315,.695/aspect) / readerDistance));
  const reader = pose(readerEye,readerLook,readerFov);
  return {
    table: portrait ? pose(focus.clone().add(offset), focus, fittedPortrait, 2.48) : desktopTable(aspect),
    education: reader, resume: reader, contact: reader,
    projects: portrait
      ? pose(v(-3.14, 1.82, -1.19), v(-1.79, 1.15, -1.20),
        MathUtils.radToDeg(2 * Math.atan(Math.max(.56, .335 / aspect))))
      : pose(v(-3.14, 1.82, -1.25), v(-1.20, 1.04, -.88), 46),
    experience: portrait
      ? pose(v(1.62, 1.63, 1.16), v(1.80, 1.35, -1.04), 59)
      : pose(v(.99, 1.64, 1.03), v(1.58, 1.28, -1.02), 39),
  };
}

// These camera tracks stay on the visitor's side of the rails and furniture.
// Each shot begins at the current eye so a redirected journey has no cut.
const shoulders = {
  projects: [v(-.56, 2.05, .98), v(-1.45, 1.88, .54), v(-2.36, 1.80, .02)],
  experience: [v(.36, 2.12, 1.18), v(.68, 1.88, 1.03)],
};
const rearAisle = [v(-2.47, 1.95, -.03), v(-1.25, 2.14, .38), v(.06, 2.15, .41), v(.73, 1.91, .68)];

export function createCameraRide(trip, start, destination) {
  const returning = trip.to === 'table';
  let via;
  if (trip.crossing && (isReaderStation(trip.from)||isReaderStation(trip.to))) {
    const left = Math.min(start.eye.x,destination.eye.x), right = Math.max(start.eye.x,destination.eye.x);
    via = rearAisle.filter(point => point.x > left + .15 && point.x < right - .15);
    if(start.eye.x > destination.eye.x)via.reverse();
  }
  else if (trip.crossing) via = trip.from === 'projects' ? rearAisle : [...rearAisle].reverse();
  else if (returning) via = [...(shoulders[trip.from] || [])].reverse();
  else via = shoulders[trip.to] || [];
  const curve = new CatmullRomCurve3([start.eye, ...via, destination.eye], false, 'centripetal');
  const end = destination;
  const sample = pose(start.eye.clone(), start.look.clone(), start.fov, start.near);
  const railFocus = v(0, 0, 0);
  return (progress, ball, ahead) => {
    const gate = trip.gateProgress ?? trip.lipProgress ?? 0;
    const lead = trip.from === 'table' ? Math.max(0, gate - .10) : 0;
    const settle = returning && trip.kind === 'spring-return' ? Math.min(.94, Math.max(.55, gate + .14)) : 1;
    const t = MathUtils.clamp((progress - lead) / Math.max(.01, settle - lead), 0, 1);
    const s = blend(t, 0, 1);
    curve.getPointAt(s, sample.eye);
    const acquire = blend(t, 0, .32);
    const release = blend(t, .61, 1);
    railFocus.copy(ball);
    if (ahead) railFocus.lerp(ahead, .28);
    sample.look.copy(start.look).lerp(railFocus, acquire).lerp(end.look, release);
    sample.fov = MathUtils.lerp(start.fov, end.fov, s);
    // The high portrait table view uses a near plane beyond the ceiling.
    // Keep it until the moving eye has cleared the ceiling.
    const clearance = Math.max(start.near, end.near) > 1 && sample.eye.y > 2.7
      ? Math.min(2.48, Math.max(.035, (sample.eye.y - 2.66) * 1.42)) : .035;
    sample.near = Math.max(clearance, MathUtils.lerp(start.near, end.near, s));
    return sample;
  };
}
