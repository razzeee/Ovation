import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { db } from "../db/index.js";
import { reviews, users, votes } from "../db/schema.js";
import {
  ErrorResponse,
  SuccessMsg,
  UserInfoResponse,
} from "../openapi/schemas.js";
import { requireAdmin, requireAuth } from "./auth.js";

const app = new Hono();

app.use("*", requireAuth);
app.use("*", requireAdmin);

const userDesc = (
  summary: string,
  description: string,
  responseSchema: import("zod").ZodType = SuccessMsg,
) =>
  describeRoute({
    tags: ["Admin Users"],
    security: [{ bearerAuth: [] }],
    summary,
    description,
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: resolver(responseSchema) } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: resolver(ErrorResponse) } },
      },
    },
  });

// ─── GET /users/:user_hash — show user info and their reviews ───────────────

app.get(
  "/:user_hash",
  userDesc(
    "Get user info",
    "Look up a user by their machine hash and return profile + review count.",
    UserInfoResponse,
  ),
  async (c) => {
    const userHash = c.req.param("user_hash");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.userHash, userHash))
      .limit(1);

    if (!user) {
      return c.json({ success: false, msg: "user not found" }, 404);
    }

    // Get their review count
    const [reviewCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.userId, user.userId));

    return c.json({
      success: true,
      user: {
        user_id: user.userId,
        user_hash: user.userHash,
        date_created: user.dateCreated.toISOString(),
        karma: user.karma,
        is_banned: user.isBanned,
        review_count: Number(reviewCount?.count ?? 0),
      },
    });
  },
);

// ─── POST /users/:user_hash/ban — ban user and delete their reviews ─────────

app.post(
  "/:user_hash/ban",
  userDesc(
    "Ban user",
    "Ban a user and delete all their reviews and associated votes.",
  ),
  async (c) => {
    const userHash = c.req.param("user_hash");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.userHash, userHash))
      .limit(1);

    if (!user) {
      return c.json({ success: false, msg: "user not found" }, 404);
    }

    // Mark as banned
    await db
      .update(users)
      .set({ isBanned: true })
      .where(eq(users.userId, user.userId));

    // Get the user's review IDs to clean up votes
    const userReviews = await db
      .select({ reviewId: reviews.reviewId })
      .from(reviews)
      .where(eq(reviews.userId, user.userId));

    const reviewIds = userReviews.map((r) => r.reviewId);

    // Delete votes on those reviews
    for (const rid of reviewIds) {
      await db.delete(votes).where(eq(votes.reviewId, rid));
    }

    // Delete all reviews
    await db.delete(reviews).where(eq(reviews.userId, user.userId));

    return c.json({
      success: true,
      msg: `banned user and deleted ${reviewIds.length} reviews`,
    });
  },
);

export default app;
