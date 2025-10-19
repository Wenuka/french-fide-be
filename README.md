# French FIDE Backend

Node.js + TypeScript backend using Express, Prisma (PostgreSQL), and Firebase Auth (JWKS).

## Tech
- Node.js + TypeScript
- Express.js
- Prisma ORM + PostgreSQL (Neon compatible)
- Firebase Auth token validation via JWKS
- CORS: http://localhost:3000, https://fideprep.ch

## Getting Started

### 1) Install dependencies
```bash
pnpm install
# or
npm install
# or
yarn install
```

### 2) Create environment file
Copy `.env.sample` to `.env` and fill values.

Required:
- `DATABASE_URL` (Neon or any PostgreSQL; include `sslmode=require` for Neon)
- `PORT` (optional, default 8080)

### 3) Prisma migrate & generate
For local dev migrations:
```bash
npm run prisma:dev
```
For CI/Prod apply migrations:
```bash
npm run prisma:deploy
```

### 4) Run dev server
```bash
npm run dev
```
Then open http://localhost:8080/health

## Endpoints

### GET /health
No auth.
```bash
curl -s http://localhost:8080/health
```
Response:
```json
{ "ok": true }
```

### POST /user/login
Requires `Authorization: Bearer <ID_TOKEN>` (Firebase ID token).
Upserts a user with `uid`, updates `email` and `emailVerified`, and ensures the user owns a default `Favourites` vocab list that is linked as their favourite list.
```bash
curl -X POST http://localhost:8080/user/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN"
```
Response:
```json
{ "ok": true }
```

### POST /user/createList
Requires `Authorization: Bearer <ID_TOKEN>`. Creates a custom vocab list for the authenticated user; optionally attach existing vocab items by ID.
```bash
curl -X POST http://localhost:8080/user/createList \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{ "listName": "My first list", "words": [1, 42, 99] }'
```
Request body:
- `listName` (string, required) – Unique per user.
- `words` (number[], optional) – `vocab_id`s to associate; pass `[]` or omit for an empty list.

Response:
```json
{
  "ok": true,
  "list": { "id": 123, "name": "My first list" },
  "vocabIds": [1, 42, 99]
}
```

### POST /user/addWords
Requires `Authorization: Bearer <ID_TOKEN>`. Adds vocab items to an existing list owned by the user.
```bash
curl -X POST http://localhost:8080/user/addWords \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{ "listId": 123, "words": [5, 9, 12] }'
```
Request body:
- `listId` (number, required) – The list to attach words to.
- `words` (number[], required) – Positive `vocab_id`s to attach.

Response:
```json
{
  "ok": true,
  "list": { "id": 123, "name": "My first list" },
  "added": [5, 9, 12],
  "skipped": []
}
```

## Scripts
- `dev` – Start dev server with auto-reload
- `build` – TypeScript build to `dist/`
- `start` – Run compiled server
- `prisma:dev` – `prisma migrate dev && prisma generate`
- `prisma:deploy` – `prisma migrate deploy && prisma generate`

## Notes
- The JWKS endpoint used is Google Secure Token: `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`.
- Ensure `audience` and `issuer` match your Firebase project.
- CORS allows `http://localhost:3000` and `https://fideprep.ch`.


connect to a new db
```
npx prisma migrate dev --name init
npx prisma generate
```

flashcard migration
```
npm run prisma:deploy
npm run backfill:favourites
```
