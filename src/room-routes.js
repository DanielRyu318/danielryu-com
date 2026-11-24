import { ROOM_GATES, ROOM_LAYOUT as layout, stationTrack, surfaceY } from './room-layout.js';
import { joinRailPaths, railPath, sectionOfPath, tuple } from './room-path.js';

const deckPoint = ([x,z]) => [x, surfaceY(z) + layout.ballRadius, z];
const tableCradle = layout.launcher.path[0];
const inlane = railPath([layout.launcher.path.at(-1), ...[
  [-.047,-.65],[-.130,-.48],[-.157,-.255],[-.147,-.015],
  [-.150,.159],[-.163,.375],[-.174,.555],[-.176,.680]
].map(deckPoint)]);
const routeNodes = { ...layout.routes, reader: layout.reader.route };
const approaches = { ...layout.approaches, reader: layout.reader.approach };
const wire = Object.fromEntries(Object.entries(routeNodes).map(([id, points]) => [id,railPath(points)]));
const crossing = railPath(layout.crossing);
const turnout = railPath(layout.reader.turnout);
const eastTurnout = railPath(layout.reader.eastTurnout);
const shooter = railPath(layout.launcher.path);
const lip = Object.fromEntries(Object.entries(wire).map(([id, path]) =>
  [id, path.firstProgress(([x,y,z]) => id === 'reader' ? y > surfaceY(z) + .11 : Math.abs(x) > layout.deck.halfWidth)]));

// Every branch junction is an exact knot in both of its modeled splines.
function junctionOn(path, point) {
  return path.firstProgress(p => Math.hypot(p[0] - point[0], p[1] - point[1], p[2] - point[2]) < 1e-8);
}
const rearLinks = {
  projects: joinRailPaths([sectionOfPath(crossing, 0, junctionOn(crossing, layout.reader.turnout[0])), turnout]),
  experience: joinRailPaths([sectionOfPath(crossing, 1, junctionOn(crossing, layout.reader.eastTurnout[0])),
    eastTurnout, sectionOfPath(turnout, junctionOn(turnout, layout.reader.eastTurnout.at(-1)), 1)])
};

function gateTangent(id) {
  const { center, direction } = ROOM_GATES[id];
  return deckPoint(center.map((v,i) => v - direction[i] * .075));
}

export function roomRoute({ from, to, position, saved, directGate, spring, current, launcherGuide, atCradle }) {
  from = stationTrack(from);
  to = stationTrack(to);
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
    if (id === to) return; // The three leaves share one seated ball.
    stationCrossing = true;
    if (to === 'reader') add(rearLinks[id]);
    else if (id === 'reader') add(sectionOfPath(rearLinks[to], 1, 0));
    else add(id === 'projects' ? crossing : sectionOfPath(crossing, 1, 0));
  }
  function fromPocket(id) {
    // The plunger may start behind the cup. Its stroke and the return wire
    // meet exactly at the original ball lock.
    connect([routeNodes[id].at(-1)]);
    lipDistance = length + wire[id].length * (1 - lip[id]);
    add(sectionOfPath(wire[id], 1, 0));
    gateDistance = length;
    connect([gateTangent(id)]);
    if (spring) return;
    connect([...approaches[id].slice().reverse().map(deckPoint), saved || tableCradle]);
  }
  if (current) {
    const p = current.data.progress;
    if (current.data.from === 'table' && to !== 'table' && current.flipperDistance > p * current.path.length) {
      add(sectionOfPath(current.path, p, current.flipperDistance / current.path.length));
      flipperDistance = length;
    } else if (to === stationTrack(current.data.from)) {
      add(sectionOfPath(current.path, p, 0));
      if (to === 'table') connect([saved || tableCradle]);
      else connect([routeNodes[to].at(-1)]);
      return finish();
    } else {
      add(sectionOfPath(current.path, p, 1));
      const end = stationTrack(current.data.to);
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
    const approach = approaches[to].map(deckPoint);
    if (flipperDistance >= 0 && to !== 'reader') {
      if (to === 'projects') approach.unshift(deckPoint([-.194,.46]));
      else approach.unshift(deckPoint([-.096,.439]));
    }
    connect([...approach, gateTangent(to), routeNodes[to][0]]);
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
