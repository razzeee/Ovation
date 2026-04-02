import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { db } from "../db/index.js";
import { components, reviews, users, votes } from "../db/schema.js";
import type { VoteRequest } from "../lib/types.js";
import { getUserKey } from "../lib/util.js";
import { jsonError, jsonSuccess } from "../middleware/error.js";
import {
  ErrorResponse,
  VoteRequest as VoteRequestSchema,
  VoteResponse,
} from "../openapi/schemas.js";
import { eventlogAdd, getClientAddress, voteExists } from "./helpers.js";

const app = new Hono();

/**
 * Internal vote handler shared by upvote/downvote/dismiss/report.
 */
async function handleVote(
  c: import("hono").Context,
  val: number,
): Promise<Response> {
  let body: VoteRequest;
  try {
    body = await c.req.json<VoteRequest>();
  } catch {
    return jsonError(c, "failed to parse JSON body");
  }

  // Validate required fields
  for (const key of [
    "review_id",
    "app_id",
    "user_hash",
    "user_skey",
  ] as const) {
    if (!(key in body) || body[key] === null || body[key] === undefined) {
      return jsonError(c, `invalid data, required ${key}`);
    }
  }

  // Check formats
  if (String(body.user_hash).length !== 40) {
    return jsonError(c, "the user_hash is invalid");
  }
  if (String(body.user_skey).length !== 40) {
    return jsonError(c, "the user_skey is invalid");
  }

  // Get or create user
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
  } else {
    // Check for ban
    if (user.isBanned) {
      return jsonError(c, "account has been disabled due to abuse");
    }
    // Check negative karma limit
    if (val < 0 && (user.karma ?? 0) < -50) {
      return jsonError(c, "all negative karma used up");
    }
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

  // Check duplicate vote
  if (await voteExists(body.review_id, user.userId)) {
    await eventlogAdd(
      getClientAddress(c),
      user.userId,
      body.app_id,
      "duplicate vote",
    );
    return jsonError(c, "already voted on this app");
  }

  // Update user karma
  await db
    .update(users)
    .set({ karma: (user.karma ?? 0) + val })
    .where(eq(users.userId, user.userId));

  // Find the review
  const review = await db
    .select({
      reviewId: reviews.reviewId,
      karmaUp: reviews.karmaUp,
      karmaDown: reviews.karmaDown,
      reported: reviews.reported,
    })
    .from(reviews)
    .innerJoin(components, eq(reviews.componentId, components.componentId))
    .where(eq(reviews.reviewId, body.review_id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!review) {
    await eventlogAdd(
      getClientAddress(c),
      user.userId,
      null,
      `invalid review ID of ${body.app_id}`,
      true,
    );
    return jsonError(c, "invalid review ID");
  }

  // Update review karma/reported
  const updates: Record<string, number> = {};
  if (val === -5) {
    updates.reported = (review.reported ?? 0) + 1;
  } else if (val === 1) {
    updates.karmaUp = (review.karmaUp ?? 0) + 1;
  } else if (val === -1) {
    updates.karmaDown = (review.karmaDown ?? 0) + 1;
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(reviews)
      .set(updates)
      .where(eq(reviews.reviewId, review.reviewId));
  }

  // Record the vote
  await db.insert(votes).values({
    userId: user.userId,
    val,
    reviewId: body.review_id,
  });

  await eventlogAdd(
    getClientAddress(c),
    user.userId,
    body.app_id,
    `voted ${val} on review`,
  );

  return jsonSuccess(c, `voted #${body.review_id} ${val}`);
}

const voteDesc = (action: string, desc: string) =>
  describeRoute({
    tags: ["Voting"],
    summary: action,
    description: desc,
    responses: {
      200: {
        description: "Vote recorded",
        content: { "application/json": { schema: resolver(VoteResponse) } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: resolver(ErrorResponse) } },
      },
    },
  });

app.post(
  "/upvote",
  voteDesc("Upvote a review", "Increase the review's karma_up by 1"),
  validator("json", VoteRequestSchema),
  (c) => handleVote(c, 1),
);
app.post(
  "/downvote",
  voteDesc("Downvote a review", "Increase the review's karma_down by 1"),
  validator("json", VoteRequestSchema),
  (c) => handleVote(c, -1),
);
app.post(
  "/dismiss",
  voteDesc("Dismiss a review", "Record a neutral vote (no karma change)"),
  validator("json", VoteRequestSchema),
  (c) => handleVote(c, 0),
);
app.post(
  "/report",
  voteDesc("Report a review", "Flag the review for moderator attention"),
  validator("json", VoteRequestSchema),
  (c) => handleVote(c, -5),
);

export default app;
