// Sentry must be initialized before any other imports
import "./instrument.js";

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import admin from "./admin/index.js";
import api from "./api/index.js";
import { config } from "./config.js";
import { errorHandler } from "./middleware/error.js";
import { registerOpenAPI } from "./openapi/index.js";
import { sentryMiddleware } from "./middleware/sentry.js";

const app = new Hono();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use("*", sentryMiddleware);
app.use("*", errorHandler);

if (config.env !== "test") {
  app.use("*", logger());
}

// CORS — allow GNOME Software (any origin) for the public API,
// and the admin SPA (same-origin by default) for admin routes.
app.use(
  "/1.0/reviews/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Content-Type"],
  }),
);

// Admin API needs CORS for the SPA (Authorization header for JWT)
app.use(
  "/admin/api/*",
  cors({
    origin: config.env === "production" ? "" : "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// ---------------------------------------------------------------------------
// Route mounts
// ---------------------------------------------------------------------------

// Public API — backward-compatible with GNOME Software clients
app.route("/1.0/reviews/api", api);

// Admin API — JWT-authenticated endpoints for the admin SPA
app.route("/admin/api", admin);

// OpenAPI spec + Swagger UI
registerOpenAPI(app);

// Sentry tunnel — forwards envelope payloads to avoid ad-blockers
app.post("/admin/sentry-tunnel", async (c) => {
  const dsn = config.sentry.dsn;
  if (!dsn) return c.text("Sentry not configured", 503);

  const body = await c.req.text();
  const header = body.split("\n")[0];
  let envelope: { dsn?: string } | undefined;
  try {
    envelope = JSON.parse(header);
  } catch {
    return c.text("Invalid envelope header", 400);
  }

  if (
    !envelope?.dsn ||
    !envelope.dsn.startsWith(dsn.split("@")[0].split("//")[0])
  ) {
    return c.text("Invalid DSN", 403);
  }

  const projectId = dsn.split("/").pop();
  const sentryHost = new URL(dsn).hostname;
  const upstream = `https://${sentryHost}/api/${projectId}/envelope/`;

  const res = await fetch(upstream, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope" },
    body,
  });

  return c.text(await res.text(), res.status as 200);
});

// Admin SPA — serve the built Vite output from dist/admin/
// Static assets (JS, CSS, images) are served directly.
// All other /admin/* paths fall through to index.html for client-side routing.
app.use(
  "/admin/*",
  serveStatic({
    root: "./dist/admin",
    rewriteRequestPath: (path) => path.replace(/^\/admin/, ""),
  }),
);

// SPA fallback — serve index.html for any unmatched /admin/* route
app.get("/admin/*", serveStatic({ path: "./dist/admin/index.html" }));
app.get("/admin", serveStatic({ path: "./dist/admin/index.html" }));

// Health check
app.get("/ping", (c) => c.text("pong"));

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
if (config.env !== "test") {
  console.log(
    `[ovation] starting on port ${config.server.port} (${config.env})`,
  );

  Bun.serve({
    fetch: app.fetch,
    port: config.server.port,
  });
}

export default app;
