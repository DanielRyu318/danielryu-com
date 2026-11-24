import layout from './room-layout.json' with { type: 'json' };

const readerPages = new Set(layout.reader.pages);
export const isReaderStation = station => readerPages.has(station);
export const stationTrack = station => isReaderStation(station) ? 'reader' : station;
export const STATION_IDS = [...Object.keys(layout.routes), ...layout.reader.pages];
export const ROOM_GATES = { ...layout.gates, reader: layout.reader.gate };
const readerAnchors = Object.fromEntries(layout.reader.pages.map(id => [id, layout.reader.route.at(-1)]));
export const ROOM_LAYOUT = { ...layout, anchors: { ...layout.anchors, ...readerAnchors } };
export const surfaceY = z => layout.deck.height - layout.deck.slope * z;

export function returnSpring(station) {
  const route = station === 'reader' || isReaderStation(station) ? layout.reader.route : layout.routes[station];
  if (!route) return null;
  const origin = route.at(-1);
  const previous = route.at(-2);
  const dx = origin[0] - previous[0], dz = origin[2] - previous[2];
  const length = Math.hypot(dx, dz);
  return { origin, direction: [dx / length, 0, dz / length], stroke: 0.09 };
}
