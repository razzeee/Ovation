import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { db } from "../db/index.js";
import { components, reviews, users } from "../db/schema.js";
import { getUserKey } from "../lib/util.js";
import { jsonError, jsonSuccess } from "../middleware/error.js";
import {
  ErrorResponse,
  RemoveRequest,
  RemoveResponse,
} from "../openapi/schemas.js";
import { eventlogAdd, getClientAddress } from "./helpers.js";

const app = new Hono();

/**
 * POST /remove – Remove a review by its author.
 */
app.post(
  "/",
  describeRoute({
    tags: ["Reviews"],
    summary: "Remove own review",
    description:
      "Allows a review author to delete their own review. Requires a valid user_skey.",
    responses: {
      200: {
        description: "Review removed",
        content: { "application/json": { schema: resolver(RemoveResponse) } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: resolver(ErrorResponse) } },
      },
    },
  }),
  validator("json", RemoveRequest),
  async (c) => {
    const body = c.req.valid("json");

    // Find the user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.userHash, body.user_hash))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!user) {
      return jsonError(c, "no review");
    }

    // Find the review belonging to this user
    const review = await db
      .select({
        reviewId: reviews.reviewId,
        componentId: reviews.componentId,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.reviewId, body.review_id),
          eq(reviews.userId, user.userId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!review) {
      return jsonError(c, "no review");
    }

    // Verify the app_id matches
    const component = await db
      .select({ appId: components.appId })
      .from(components)
      .where(eq(components.componentId, review.componentId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!component || component.appId !== body.app_id) {
      return jsonError(c, "the app_id is invalid");
    }

    // Verify user_skey
    const expectedSkey = getUserKey(body.user_hash, body.app_id);
    if (body.user_skey !== expectedSkey) {
      await eventlogAdd(
        getClientAddress(c),
        user.userId,
        null,
        `invalid user_skey of ${body.user_skey}`,
        true,
      );
      return jsonError(c, "invalid user_skey");
    }

    // Delete the review
    await db.delete(reviews).where(eq(reviews.reviewId, body.review_id));

    await eventlogAdd(
      getClientAddress(c),
      user.userId,
      body.app_id,
      "removed review",
    );

    return jsonSuccess(c, `removed review #${body.review_id}`);
  },
);

export default app;
