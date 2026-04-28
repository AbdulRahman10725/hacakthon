# Create/Login Fix

## Root Cause

The login form submitted correctly, but the browser reported `Failed to fetch` because the backend was not reachable:

1. **The default `npm run dev` only started the frontend.**
  - The backend was not running on port 4000, so the browser could not connect.
2. **When the backend was started manually, it could still fail to boot in dev if `JWT_SECRET` was missing or too short.**
  - That caused the server to exit before listening on port 4000.
3. **CORS was only enabled when `CLIENT_ORIGIN` was set.**
  - When unset in local dev, the browser blocked the request.

## What Was Fixed

- Added a development fallback for `JWT_SECRET` so the backend can run locally.
- Allowed short secrets in development while enforcing length in production.
- Enabled CORS automatically in development when `CLIENT_ORIGIN` is not set.
- Improved client-side error messages to show the exact server URL that failed.
- Updated `npm run dev` to start both frontend and backend together.

## Files Changed

- server/src/config/env.ts
  - Allowed dev fallback secrets and production-only length validation.
- server/src/index.ts
  - Enabled CORS by default in development.
- app/_lib/api.ts
  - Added better error handling for unreachable server.
- package.json
  - Runs frontend + backend together in `npm run dev`.

## Why the Bug Happened

- `npm run dev` started only the frontend, leaving the backend down.
- The backend could also fail to boot without a JWT secret.
- Missing CORS headers blocked browser requests.

## How the Join Flow Works Now

1. User submits the join form.
2. Frontend posts to `/api/auth/join` using `NEXT_PUBLIC_API_BASE` or default `http://<host>:4000`.
3. Backend accepts the request, creates/joins a room, and returns session data.
4. Frontend stores the session and navigates to `/room/:roomId`.

## Tricky Logic Explained

- **JWT fallback:** In non-production, `JWT_SECRET` defaults to a 32+ character dev value to prevent server startup failures.
- **CORS default:** `cors({ origin: true })` is enabled in development so the browser allows requests from `localhost:3000`.
- **Fetch error message:** On a network failure, the UI now shows the exact backend base URL so the developer can verify it is running.

## Verification Checklist

- Run `npm run dev` (starts both frontend and backend).
- Submit the join form with a name.
- Verify navigation to `/room/:roomId`.

## Assumptions

- Local dev uses `localhost:3000` for frontend and `localhost:4000` for backend.
- `NEXT_PUBLIC_API_BASE` can override the backend URL if needed.

## Future Improvements

- Add a small connectivity test on the login screen (health check).
- Add friendly CORS warnings in the console for common misconfigurations.
- Persist the last used room ID for quick rejoin.
