import layout from './room-layout.json' with { type: 'json' };

export const ROOM_LAYOUT = layout;
export const surfaceY = z => layout.deck.height - layout.deck.slope * z;
