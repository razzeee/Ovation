#!/bin/sh
set -eu

echo "[ovation] running database migrations..."
bun run db:migrate

echo "[ovation] starting server..."
exec bun run start
