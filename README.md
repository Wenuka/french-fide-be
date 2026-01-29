# FIDE Prep Backend

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
- `FIREBASE_PROJECT_ID` (eg: test-fide-prep)

### 3) Prisma migrate & generate
For local dev migrations (that creates migration files and push to the test db (?)):
Note: Never ever run on prod
```bash
npm run prisma:dev
```
For CI/Prod apply migrations (apply existing migration files to the prod db, no migration files):
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
  -d '{ "listName": "My first list", "words": [1, { "reference_id": 42 }, { "custom_vocab_id": 99 }] }'
```
Request body:
- `listName` (string, required) – Unique per user.
- `words` (array, optional) – Items to associate; each entry may be a numeric `vocab_id` or an object containing `reference_id` or `custom_vocab_id`. Pass `[]` or omit for an empty list.

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
  -d '{ "listId": 123, "words": [5, { "reference_id": 9 }, { "custom_vocab_id": 12 }] }'
```
Request body:
- `listId` (number, required) – The list to attach words to.
- `words` (array, required) – Vocab identifiers to attach; each entry may be a numeric `vocab_id` or an object containing `reference_id` or `custom_vocab_id`.

Response:
```json
{
  "ok": true,
  "list": { "id": 123, "name": "My first list" },
  "added": [5, 9, 12],
  "skipped": []
}
```

### POST /user/word-text
Requires `Authorization: Bearer <ID_TOKEN>`. Returns source/target text for vocab items referenced either by list IDs (owned by the user) or explicit vocab identifiers (`vocabId`, `referenceId`, or `customVocabId`).
```bash
curl -X POST http://localhost:8080/user/word-text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{ "listIds": [123], "wordIds": [{ "customVocabId": 45 }] }'
```
Response:
```json
{
  "ok": true,
  "words": [
    {
      "vocabId": 987,
      "referenceKind": "DEFAULT",
      "referenceId": 321,
      "customVocabId": null,
      "sourceLang": "FR",
      "targetLang": "EN",
      "sourceText": "prendre rendez-vous",
      "targetText": "to make an appointment",
      "listIds": [123]
    }
  ]
}
```
By default the endpoint attempts to load default vocabulary strings from `process.env.DEFAULT_VOCAB_PATH`. If unset it will look for `data/default-vocab.json` or the front-end `french-fide/src/assets/main-vocab.json`. Populate one of these locations to enable translations for default vocab entries.

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


connect to a new db (only for the test db)
```bash
npx prisma migrate dev --name init # only for the test db
npx prisma generate
```

flashcard migration
```bash
npm run prisma:deploy
npm run generate:vocab-default-ref # to generate default vocab table
npm run backfill:favourites # check whether we need to backfill langs
```
