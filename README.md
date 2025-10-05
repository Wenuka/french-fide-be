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
Upserts a user with `uid`, updates `email` and `emailVerified`.
```bash
curl -X POST http://localhost:8080/user/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN"
```
Response:
```json
{ "ok": true }
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