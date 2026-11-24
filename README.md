# Night Shift · Daniel Ryu’s Pinball Workshop

The pinball machine and the room are the website.

Night Shift is a playable observatory cabinet in a timber workshop. The desktop camera looks straight down the centreline from the flippers. The Projects wire ramp carries the ball to a Cline Financial desk. The Experience tunnel leads to the archive. An illuminated reader in the backbox serves Education and Credentials, Résumé, and Contact.

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
- Knock down all three telegraph blades to advance the ratchet dial, score a 500-point bonus, and arm Education. The west and east rollover lanes arm Résumé and Contact. Shoot the upper collector for the selected record in Explore mode. Selecting any destination on the table calls it directly.
- The spinner and spring-loaded captive ball score independently. The illuminated START key launches a ready ball.
- At the desk, add a $500 deposit on the monitor and compare the balance and time-weighted return. Use the physical Experience switch to continue to the archive.
- Select a job card to read its entry. The reader, project desk, and archive each have a return plunger. Pull it away from its cup and release to send the ball back into free play. Space also charges the spring.
- At the reader, the Education selector opens the academic record and the exams key reveals the passed actuarial exams. The other keys open the original résumé PDF, email composer, LinkedIn or GitHub. The PDF key on the apron also opens the résumé immediately.
- To restore the exact shot you left, use **Back to the flippers** and **Resume ball**.
- The guide provides keyboard access to destinations and station controls. Shareable routes include `/#projects/cline-financial`, `/#experience`, `/#education`, `/#resume`, and `/#contact`. Reduced motion skips camera travel. The sound control enables synthesized machine audio.

## Scene and mechanics

`art/workshop.blend` is the editable Blender scene. The browser loads the optimized `public/models/workshop.glb`. The playfield uses an original generated lithograph in `art/night-shift-print.webp`, overprinted with mechanical markings at build time. To regenerate the scene and browser asset, use Python with Pillow and Blender 5.3 from the repository root.

```sh
python scripts/paint_workshop.py
blender --background --python scripts/build_workshop.py
```

`src/room-layout.json` and `src/room-mechanisms.json` define shared dimensions, pivots, and rail paths in metres. The Blender generator and runtime both read them. Rapier simulates free play and the captive-ball spring. Guided paths carry the ball through the launch channel and between room stations. Three.js draws the room, follows the ball, and maps pointer input to physical objects. `src/room-camera.js` fits the cabinet and follows the rails. The monitor and archive are in `src/room-stations.js`. The reader and text fallback share the verified records in `src/room-index-data.js`.

## Review deployment

Vercel builds with `npm run build` and serves `dist/`. The frontend requires no environment variables. Use `vercel deploy` on the linked project for a review preview. The next creative decision is whether the opening scale, room lighting, and continuous camera journey are right for the expanded portfolio.
