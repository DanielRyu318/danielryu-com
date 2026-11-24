# Daniel Ryu’s Pinball Workshop

The pinball machine and the room are the website.

This playable review build follows one journey through the workshop. The Projects rail takes a steel ball from the cabinet to a desk where a CRT runs a Cline Financial demo. From the desk, a brass switch sends the ball to an Experience archive across the room.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Run `npm test` for the physics regression suite. Use `npm run build` and `npm run preview` to play the bundled version.

## Play and explore

- Drag the ball against the spring, then release. On a keyboard, hold and release Space to launch and press the arrow keys to flip. Touch devices have left and right flipper buttons.
- In Explore mode, take a destination shot or select its labeled entrance on the cabinet. In Play mode, a shot lights its destination and leaves the ball in play.
- At the desk, add a $500 deposit on the monitor and compare the balance and time-weighted return. Use the physical Experience switch to continue to the archive.
- Select a job card to read its entry. Return to the flippers and choose **Resume ball** to continue an interrupted game.
- The workshop guide provides keyboard access to destinations, station controls, and the résumé. Direct links include `/#projects/cline-financial` and `/#experience`. Reduced motion skips camera travel. The sound control enables the synthesized machine audio.

## Scene and mechanics

`art/workshop.blend` is the editable Blender scene. The browser loads the optimized `public/models/workshop.glb`. To regenerate both, use Python with Pillow and Blender 5.3 from the repository root.

```sh
python scripts/paint_workshop.py
blender --background --python scripts/build_workshop.py
```

`src/room-layout.json` defines shared dimensions, pivots, and rail paths in metres. The Blender generator and runtime both read it. Rapier simulates free play on the deck. Guided paths carry the ball through the launch channel and between room stations. Three.js draws the room, follows the ball, and maps pointer input to physical objects. The monitor, switch, and archive content are in `src/room-stations.js`.

## Review deployment

Vercel builds with `npm run build` and serves `dist/`. The frontend requires no environment variables. Use `vercel deploy` on the linked project for a review preview. The next creative decision is whether the opening scale, room lighting, and continuous camera journey are right for the expanded portfolio.
