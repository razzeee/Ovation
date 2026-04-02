import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";
import { db } from "../db/index.js";
import { components } from "../db/schema.js";
import {
  getAllRatings,
  getComponentAppIds,
  getRatingForComponent,
} from "../lib/ratings.js";
import { AllRatings, AppRating } from "../openapi/schemas.js";

const app = new Hono();

/**
 * GET /ratings/:app_id - Get star ratings for a specific application.
 */
app.get(
  "/:app_id",
  describeRoute({
    tags: ["Ratings"],
    summary: "Get ratings for an app",
    description:
      "Returns aggregated star ratings for a specific application and its related components.",
    responses: {
      200: {
        description: "Rating breakdown or empty array if not found",
        content: {
          "application/json": {
            schema: resolver(z.union([AppRating, z.array(z.never())])),
          },
        },
      },
    },
  }),
  async (c) => {
    const appId = c.req.param("app_id");

    const appIds = await getComponentAppIds(appId);
    const rating = await getRatingForComponent(appIds);

    return c.json(rating ?? []);
  },
);

/**
 * GET /ratings - Get star ratings for all known applications.
 */
app.get(
  "/",
  describeRoute({
    tags: ["Ratings"],
    summary: "Get all ratings",
    description: "Returns star ratings for every known application.",
    responses: {
      200: {
        description: "Map of app_id to rating breakdown",
        content: { "application/json": { schema: resolver(AllRatings) } },
      },
    },
  }),
  async (c) => {
    const ratings = await getAllRatings();
    return c.json(ratings);
  },
);

export default app;
