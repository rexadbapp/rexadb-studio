#!/bin/sh
set -e

mkdir -p /app/data

./node_modules/.bin/drizzle-kit migrate

if [ -n "$ADMIN_PASSWORD" ]; then
  ./node_modules/.bin/tsx src/db/create-admin.ts
fi

exec node server.js
