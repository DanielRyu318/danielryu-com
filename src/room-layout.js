import layout from './room-layout.json' with { type: 'json' };

export const ROOM_LAYOUT = layout;
export const surfaceY = z => layout.deck.height - layout.deck.slope * z;

export function returnSpring(station) {
  const route = layout.routes[station];
  if (!route) return null;
  const origin = route.at(-1);
  const previous = route.at(-2);
  const dx = origin[0] - previous[0], dz = origin[2] - previous[2];
  const length = Math.hypot(dx, dz);
  return { origin, direction: [dx / length, 0, dz / length], stroke: 0.09 };
}
