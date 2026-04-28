This is a Next.js frontend with a separate Node.js backend (Express + SQLite) for LIGMA Phase 1.

## Getting Started

### Project Structure

- `app/` Next.js UI (currently starter shell)
- `server/` Express + SQLite backend (Phase 1 scope)
- `shared/` Shared types and protocol shapes for REST/WS

### Backend (Phase 1)

The backend implements the Phase 1 foundation only:

- Auth join flow (JWT issued on join)
- Room creation + lookup
- SQLite schema and append-only event store foundation
- REST endpoints for room state

#### Environment Variables

Create a `.env` file (or set env vars) for the server:

```
JWT_SECRET=replace_with_32_plus_char_secret
DATABASE_URL=./data/ligma.db
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
```

#### Run the Backend

```
npm install
npm run server:dev
```

Server starts on `http://localhost:4000`.

#### REST Endpoints (Phase 1)

- `POST /api/auth/join`
	- Body: `{ "displayName": "Name", "roomId": "uuid?", "role": "LEAD|CONTRIBUTOR|VIEWER" }`
	- Response: `{ userId, displayName, role, token, color, roomId }`
- `POST /api/rooms`
	- Auth: `Authorization: Bearer <token>`
	- Body: `{ "name": "optional" }`
	- Response: `{ roomId, shareUrl }`
- `GET /api/rooms/:roomId`
	- Auth: `Authorization: Bearer <token>`
	- Response: Room metadata
- `GET /api/rooms/:roomId/state`
	- Auth: `Authorization: Bearer <token>`
	- Response: `{ roomId, nodes, sequenceNumber, members }`

#### How It Works (Phase 1)

- `POST /api/auth/join` creates a user and a room membership, assigns a cursor color, and issues a 1-hour JWT.
- If `roomId` is omitted, a new room is created and the joining user is assigned `LEAD`.
- Room state is read from the materialized `canvas_nodes` table and membership data from `room_members`.
- Events are append-only in the `events` table; sequence numbers are auto-incremented by SQLite.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
