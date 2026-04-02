# Ovation

A web service for submitting application reviews, built with Bun, Hono, and PostgreSQL.

> **Credit:** This project is heavily based on [odrs-web](https://gitlab.gnome.org/Infrastructure/odrs-web).

## Setting up local environment

The easiest way is to run `docker compose up` in the root directory. This will
bring up a local Ovation instance with a PostgreSQL database. The app is available
at http://localhost:8080.

### Development without Docker

```shell
bun install
docker compose up db          # start PostgreSQL only
bun run db:migrate
bun run db:seed               # optional: seed sample data
bun run dev                   # API server (hot-reload)
bun run dev:admin             # admin UI (Vite dev server)
```

The seed script creates a default admin account you can use to log into the
admin UI at http://localhost:5173/admin/:

- **Email:** `admin@test.com`
- **Password:** `Pa$$w0rd`

### API documentation

Interactive API docs (Swagger UI) are available at http://localhost:8080/docs.
The raw OpenAPI 3.1 spec is served at http://localhost:8080/openapi.json.

### Example local requests

Submit a review:
```shell
curl -w '\n' -X POST http://localhost:8080/1.0/reviews/api/submit --json '{"app_id": "org.example.app", "locale": "en_US", "summary": "Good App", "description": "Loved it", "user_hash": "a17fed27eaa842282862ff7c1b9c8395a26ac322", "version": "1.0", "distro": "debian", "rating": 100, "user_display": "Happy User"}'
```

Query ratings:
```shell
curl -w '\n' http://localhost:8080/1.0/reviews/api/ratings/org.example.app
```

### Generating migration files

If you modify the database schema in `src/db/schema.ts`, generate a new migration:

```shell
bun run db:generate
```

This creates a new file in `migrations/`.

### Running tests

```shell
bun test              # run all tests
bun run typecheck     # TypeScript type checking
bun run lint          # Biome linter
```
