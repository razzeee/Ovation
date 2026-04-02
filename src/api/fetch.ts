import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { getReviewScore } from "../lib/review-score.js";
import type { ReviewApiResponse } from "../lib/types.js";
import { localeIsCompatible } from "../lib/util.js";
import {
  ErrorResponse,
  FetchRequest,
  FetchResponse,
  ReviewApiItem,
} from "../openapi/schemas.js";
import {
  getComponentAppIds,
  queryReviewsForApp,
  reviewAsDict,
  voteExists,
} from "./helpers.js";

const app = new Hono();

/**
 * POST /fetch – Return scored reviews for an application.
 * This is the primary endpoint used by GNOME Software to fetch reviews.
 */
app.post(
  "/",
  describeRoute({
    tags: ["Reviews"],
    summary: "Fetch reviews for an application",
    description:
      "Returns scored reviews for an application, filtered by locale compatibility. This is the primary endpoint used by GNOME Software.",
    responses: {
      200: {
        description: "Array of reviews sorted by relevance score",
        content: { "application/json": { schema: resolver(FetchResponse) } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: resolver(ErrorResponse) } },
      },
    },
  }),
  validator("json", FetchRequest),
  async (c) => {
    const body = c.req.valid("json");

    // Resolve all related app IDs (self + parent + children + compat_ids)
    const appIds = await getComponentAppIds(body.app_id);
    if (body.compat_ids) {
      for (const cid of body.compat_ids) {
        appIds.add(cid);
      }
    }

    // Query reviews
    const reviewRows = await queryReviewsForApp(Array.from(appIds));

    // Ensure user exists (create if not)
    let user = await db
      .select()
      .from(users)
      .where(eq(users.userHash, body.user_hash))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({ userHash: body.user_hash })
        .returning();
      user = newUser;
    }

    // Filter by locale compatibility and compute scores
    const items: (ReviewApiResponse & { score: number })[] = [];

    for (const row of reviewRows) {
      // Skip reviews the user can't read due to locale mismatch
      if (row.locale && !localeIsCompatible(row.locale, body.locale)) {
        continue;
      }

      const item = reviewAsDict(row, body.user_hash) as ReviewApiResponse & {
        score: number;
      };

      item.score = getReviewScore(
        {
          karmaUp: row.karmaUp ?? 0,
          karmaDown: row.karmaDown ?? 0,
          dateCreated: row.dateCreated,
          version: row.version,
          distro: row.distro,
        },
        { version: body.version, distro: body.distro },
      );

      item.user_skey = getUserKey(body.user_hash, item.app_id);

      // Mark if user already voted on this review
      if (row.userId && (await voteExists(row.reviewId, user.userId))) {
        item.vote_id = 1;
      }

      items.push(item);
    }

    // If no reviews found, return a fake entry with user_skey so the client
    // can use it for future votes
    if (items.length === 0) {
      items.push({
        score: 0,
        app_id: body.app_id,
        user_hash: body.user_hash,
        user_skey: getUserKey(body.user_hash, body.app_id),
      } as ReviewApiResponse & { score: number });
    }

    // Sort by score descending
    items.sort((a, b) => b.score - a.score);

    // Apply pagination
    const limit = body.limit === 0 ? 50 : (body.limit ?? 50);
    const start = body.start ?? 0;
    const paged = items.slice(start, start + limit);

    return c.json(paged);
  },
);

/**
 * GET /app/:app_id/:user_hash? – Return all reviews for an app (simple variant).
 */
app.get(
  "/app/:app_id/:user_hash?",
  describeRoute({
    tags: ["Reviews"],
    summary: "Get reviews for an app by ID",
    description:
      "Returns all reviews for an application. Simpler alternative to POST /fetch.",
    responses: {
      200: {
        description: "Array of reviews",
        content: {
          "application/json": { schema: resolver(z.array(ReviewApiItem)) },
        },
      },
    },
  }),
  async (c) => {
    const appId = c.req.param("app_id");
    const userHash = c.req.param("user_hash") ?? undefined;

    const appIds = await getComponentAppIds(appId);
    const reviewRows = await queryReviewsForApp(Array.from(appIds));

    const items = reviewRows.map((row) => reviewAsDict(row, userHash));
    return c.json(items);
  },
);

export default app;
