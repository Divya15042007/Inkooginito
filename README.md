# Inkooginito

A real-time collaborative whiteboard and fake-artist multiplayer game ready for local development and public deployment.

The runtime is browser-capability independent: drawing uses normalized pointer input and sound effects are optional no-op compatibility hooks. The server owns room state and exposes configurable bounds for predictable resource usage.

## Features

- Real-time room creation and join-by-code flow
- Public room discovery and invite links
- Collaborative drawing canvas with undo/redo
- Fake artist gameplay, voting, and round logic
- AI-powered word generation with category and difficulty support
- Production-friendly health and readiness endpoints
- Docker support for deployment

## Run locally

1. Install dependencies
   npm install
2. Create a local env file from [.env.example](.env.example)
3. Add your Gemini key
4. Start the app
   npm run dev

## Production deployment

### Option 1: Docker

1. Copy [.env.example](.env.example) to `.env`
2. Fill in `APP_URL`, `GEMINI_API_KEY`, and `PORT`
3. Build and run

   docker build -t inkooginito .
   docker run -p 3000:3000 --env-file .env inkooginito

### Option 2: Cloud Run / platform deploy

- Set `APP_URL` to the public hostname
- Set `GEMINI_API_KEY` in your platform secret manager
- Expose port 3000
- Health checks should hit `/health` and `/ready`

### Runtime configuration

Copy `.env.example` and set `APP_URL`, `NODE_ENV`, and `PORT` for the target platform. The remaining values cap request size, stroke complexity, room history, chat history, and abandoned-room retention. Tune them for the platform's memory budget rather than changing application code.

The current room repository is process-local. Run one application instance for the included deployment, or add a shared room store and WebSocket fan-out before enabling multiple replicas. Without shared state, a load balancer can send reconnecting players to different instances.

## Public access notes

- Invite links use the public app URL, not localhost
- Room codes can be shared by copy link or custom URL parameter
- For external players, the tunnel or hosting platform must allow access to the app host

## Useful endpoints

- `/health`
- `/ready`
- `/api/config`
- `/api/words`
- `/api/rooms`
- `/api/rooms/create`
