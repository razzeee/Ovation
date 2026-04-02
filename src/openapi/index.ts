import type { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";

/**
 * Register the /openapi.json spec endpoint and /docs Swagger UI.
 */
export function registerOpenAPI(app: Hono) {
  app.get(
    "/openapi.json",
    openAPIRouteHandler(app, {
      documentation: {
        openapi: "3.1.0",
        info: {
          title: "Ovation",
          version: "1.0.0",
          description:
            "API for submitting and querying application reviews for GNOME Software and compatible clients.",
          license: { name: "GPL-3.0-or-later" },
        },
        servers: [
          { url: "http://localhost:8080", description: "Local development" },
        ],
        tags: [
          {
            name: "Reviews",
            description: "Public review submission and retrieval",
          },
          { name: "Ratings", description: "Aggregated app star ratings" },
          {
            name: "Voting",
            description: "Upvote, downvote, dismiss, or report reviews",
          },
          { name: "Moderation", description: "Public moderation queue" },
          { name: "Admin Auth", description: "Admin login" },
          {
            name: "Admin Reviews",
            description: "Review management (requires JWT)",
          },
          {
            name: "Admin Moderators",
            description: "Moderator management (requires JWT)",
          },
          {
            name: "Admin Components",
            description: "Component management (requires JWT + admin)",
          },
          {
            name: "Admin Taboos",
            description: "Taboo word management (requires JWT + admin)",
          },
          {
            name: "Admin Users",
            description: "User management (requires JWT + admin)",
          },
          {
            name: "Admin Stats",
            description: "Statistics (requires JWT + admin)",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description: "JWT token obtained from POST /admin/api/login",
            },
          },
        },
      },
    }),
  );

  // Serve Swagger UI using CDN
  app.get("/docs", (c) => {
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ovation API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`);
  });
}
