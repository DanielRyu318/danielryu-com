import { ROOM_LAYOUT as layout, surfaceY } from './room-layout.js';
import { joinRailPaths, railPath, sectionOfPath, tuple } from './room-path.js';

const deckPoint = ([x,z]) => [x, surfaceY(z) + layout.ballRadius, z];
const tableCradle = layout.launcher.path[0];
const inlane = railPath([layout.launcher.path.at(-1), ...[
  [-.047,-.65],[-.130,-.48],[-.157,-.255],[-.147,-.015],
  [-.150,.159],[-.163,.375],[-.174,.555],[-.176,.680]
].map(deckPoint)]);
const wire = Object.fromEntries(Object.entries(layout.routes).map(([id, points]) => [id,railPath(points)]));
const crossing = railPath(layout.crossing);
const shooter = railPath(layout.launcher.path);
const lip = Object.fromEntries(Object.entries(wire).map(([id, path]) =>
  [id, path.firstProgress(([x]) => Math.abs(x) > layout.deck.halfWidth)]));

function gateTangent(id) {
  const { center, direction } = layout.gates[id];
  return deckPoint(center.map((v,i) => v - direction[i] * .075));
}

export function roomRoute({ from, to, position, saved, directGate, spring, current, launcherGuide, atCradle }) {
  const segments = [];
  let length = 0, gateDistance = 0, lipDistance = 0, flipperDistance = -1;
  let stationCrossing = false;
  let last = tuple(position);
  function add(path) {
    segments.push(path);
    length += path.length;
    last = tuple(path.at(1));
  }
  function connect(points) { add(railPath([last, ...points])); }
  function cross(id) {
    stationCrossing = true;
    add(id === 'projects' ? crossing : sectionOfPath(crossing, 1, 0));
  }
  function fromPocket(id) {
    // The plunger may start behind the cup. Its stroke and the return wire
    // meet exactly at the original ball lock.
    connect([layout.anchors[id]]);
    lipDistance = length + wire[id].length * (1 - lip[id]);
    add(sectionOfPath(wire[id], 1, 0));
    gateDistance = length;
    connect([gateTangent(id)]);
    if (spring) return;
    connect([...(layout.approaches[id] || []).slice().reverse().map(deckPoint), saved || tableCradle]);
  }
  if (current) {
    const p = current.data.progress;
    if (current.data.from === 'table' && to !== 'table' && current.flipperDistance > p * current.path.length) {
      add(sectionOfPath(current.path, p, current.flipperDistance / current.path.length));
      flipperDistance = length;
    } else if (to === current.data.from) {
      add(sectionOfPath(current.path, p, 0));
      if (to === 'table') connect([saved || tableCradle]);
      else connect([layout.anchors[to]]);
      return finish();
    } else {
      add(sectionOfPath(current.path, p, 1));
      const end = current.data.to;
      if (wire[end]) {
        if (to === 'table') fromPocket(end);
        else cross(end);
        return finish();
      }
    }
  } else if (wire[from]) {
    if (to === 'table') fromPocket(from);
    else cross(from);
    return finish();
  } else if (atCradle || launcherGuide) {
    add(launcherGuide ? sectionOfPath(launcherGuide.path, launcherGuide.progress, 1) : shooter);
    add(inlane);
    flipperDistance = length;
  }
  if (!wire[to]) {
    connect([layout.anchors[to]]);
    return finish();
  }
  if (directGate) {
    // Preserve a real shot's lateral offset. A ball just inside the mouth
    // should continue forward, never backtrack to the painted threshold.
    const blendLength = .12;
    const end = blendLength / wire[to].length;
    connect([tuple(wire[to].at(end * .48)), tuple(wire[to].at(end))]);
    lipDistance = length + (lip[to] - end) * wire[to].length;
    add(sectionOfPath(wire[to], end, 1));
  } else {
    const approach = layout.approaches[to].map(deckPoint);
    if (flipperDistance >= 0) {
      if (to === 'projects') approach.unshift(deckPoint([-.194,.46]));
      else approach.unshift(deckPoint([-.096,.439]));
    }
    connect([...approach, gateTangent(to), layout.routes[to][0]]);
    gateDistance = length;
    lipDistance = length + lip[to] * wire[to].length;
    add(wire[to]);
  }
  return finish();

  function finish() {
    const path = joinRailPaths(segments.length ? segments : [railPath([last])]);
    return { path, flipperDistance, gateDistance, lipDistance, crossing: stationCrossing };
  }
}
