# Pinball Works

Daniel Ryu’s playable portfolio is a Vite application with a Three.js cabinet, a fixed-step pinball simulation, synthesized mechanical audio, and HTML portfolio stations.

## Run the workshop

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Run `npm test` for the physics regression tests. Run `npm run build` and `npm run preview` to serve the production bundle.

## Controls and routes

- Space launches a ball. The left and right arrows operate the flippers. Touch controls sit beneath the table on smaller screens.
- Select a physical target or a station link to visit it. Bumper hits during play offer a link and keep the game running.
- Leaving a live ball pauses its simulation. Choose **Resume ball** after returning to the workshop floor.
- Every station has a hash route, such as `/#experience`. Projects have shareable links, including `/#projects/cline-financial`.
- Audio is opt-in. The sound setting persists in the browser. Game statistics apply to the current page session.

## Extend the portfolio

Add projects to the `projects` collection in `src/stations.js`. Each entry supplies a stable slug, display name, description, and a function that renders its content. It appears in the existing selector and automatically supports a direct link. Experience entries use the adjacent `experiences` collection.

For a new physical station, add its geometry, parking point, and picking position in `src/workshop-model.js`, its camera pose in `src/workshop.js`, and its HTML content in `src/stations.js`. Register its route and accessible link in `src/main.js` and `index.html`. Shared coordinates and collision shapes for playable elements live in `src/pinball.js`.

The scene renders on demand while idle. Station text and navigation work independently of WebGL. Reduced-motion preferences skip camera travel. Fonts, illustrations, audio synthesis, and the résumé are served with the application.

## Publish

The Vercel configuration builds with `npm run build` and serves `dist/`. The frontend requires no environment variables. Use `vercel deploy --prod` from the linked project, or Vercel’s GitHub integration.
