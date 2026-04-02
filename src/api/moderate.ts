import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";
import { db } from "../db/index.js";
import { components, reviews, users } from "../db/schema.js";
import { localeIsCompatible } from "../lib/util.js";
import { jsonError } from "../middleware/error.js";
import { ErrorResponse, ReviewApiItem } from "../openapi/schemas.js";
import { reviewAsDict, voteExists } from "./helpers.js";

const app = new Hono();

/**
 * GET /moderate/:user_hash/:locale? – Return reviews the user can moderate.
 * Only returns reviews the user has NOT already voted on, up to 250.
 */
app.get(
  "/:user_hash/:locale?",
  describeRoute({
    tags: ["Moderation"],
    summary: "Get moderation queue",
    description:
      "Returns reviews the user has not yet voted on, optionally filtered by locale. Limited to 250 results.",
    responses: {
      200: {
        description: "Array of reviews to moderate",
        content: {
          "application/json": { schema: resolver(z.array(ReviewApiItem)) },
        },
      },
      400: {
        description: "User not found",
        content: { "application/json": { schema: resolver(ErrorResponse) } },
      },
    },
  }),
  async (c) => {
    const userHash = c.req.param("user_hash");
    const locale = c.req.param("locale") ?? null;

    // Find user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.userHash, userHash))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!user) {
      return jsonError(c, `no user for ${userHash}`);
    }

    // Fetch reviews with their component and user data
    const allReviews = await db
      .select({
        reviewId: reviews.reviewId,
        dateCreated: reviews.dateCreated,
        locale: reviews.locale,
        summary: reviews.summary,
        description: reviews.description,
        userDisplay: reviews.userDisplay,
        version: reviews.version,
        distro: reviews.distro,
        rating: reviews.rating,
        karmaUp: reviews.karmaUp,
        karmaDown: reviews.karmaDown,
        reported: reviews.reported,
        componentId: reviews.componentId,
        userId: reviews.userId,
        componentAppId: components.appId,
        userHash: sql<string | null>`NULL`.as("userHash"),
      })
      .from(reviews)
      .innerJoin(components, eq(reviews.componentId, components.componentId));

    const items = [];
    for (const row of allReviews) {
      // Filter by locale if specified
      if (locale && row.locale && !localeIsCompatible(row.locale, locale)) {
        continue;
      }

      // Skip reviews the user already voted on
      if (await voteExists(row.reviewId, user.userId)) {
        continue;
      }

      items.push(reviewAsDict(row, userHash));

      if (items.length > 250) break;
    }

    return c.json(items);
  },
);

export default app;
