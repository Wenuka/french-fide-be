#!/bin/bash

# Load .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set."
  echo "Please start the script with DATABASE_URL=... or ensure a .env file exists."
  exit 1
fi

echo "Dumping database structure from DATABASE_URL using Prisma..."

# Use prisma migrate diff to generate the SQL schema
# --from-empty: compare against an empty state
# --to-url: compare against the current database
# --script: output as SQL script
npx prisma migrate diff --from-empty --to-url "$DATABASE_URL" --script > db_structure.sql

if [ $? -eq 0 ]; then
  echo "Database structure dumped successfully to db_structure.sql"
else
  echo "Error: Failed to dump database structure."
  exit 1
fi
