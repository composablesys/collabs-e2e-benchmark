# site

Source for a Docker container that runs `$FRAMEWORK`'s web server.

That server serves the app itself (browser code) and also connects different users to each other.

## Organization

- `src/site`: Source for the browser side of the app, built with Webpack (`npm run build:site`, or `npm run dev:site` for dev mode). The app code is shared by all frameworks; include `?framework=<value of $FRAMEWORK>` in the URL (passed to `../chrome-in-docker`) to specify which framework to use.
- `src/server`: Source for the servers. This serves static content, and for Collabs and Automerge, a basic WebSocket echo service. (For Yjs, `npm run yjs-ws` instead runs a `y-websocket` server.)
