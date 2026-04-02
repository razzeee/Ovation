import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { voteExists } from "../api/helpers.js";
import { getTaboosForLocale } from "../api/helpers.js";
import { db } from "../db/index.js";
import { components, reviews, taboos, users, votes } from "../db/schema.js";
import { tokenize } from "../lib/util.js";
import {
  AdminReviewDetailResponse,
  AdminReviewListQuery,
  AdminReviewListResponse,
  AdminReviewModifyRequest,
  AdminReviewSearchQuery,
  ErrorResponse,
  SuccessMsg,
} from "../openapi/schemas.js";
import { getModerator, requireAdmin, requireAuth } from "./auth.js";

const app = new Hono();

// All routes require authentication
app.use("*", requireAuth);

const adminReviewDesc = (
  summary: string,
  description: string,
  responseSchema: import("zod").ZodType = SuccessMsg,
) =>
  describeRoute({
    tags: ["Admin Reviews"],
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
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: resolver(ErrorResponse) } },
      },
    },
  });

// ─── GET /reviews — list reviews with pagination ────────────────────────────

app.get(
  "/",
  adminReviewDesc(
    "List reviews",
    "Paginated list of reviews. Use filter=reported for reported reviews only.",
    AdminReviewListResponse,
  ),
  validator("query", AdminReviewListQuery),
  async (c) => {
    const q = c.req.valid("query");
    const page = q.page ?? 1;
    const perPage = q.per_page ?? 20;
    const filter = q.filter;

    let query = db
      .select({
        reviewId: reviews.reviewId,
        dateCreated: reviews.dateCreated,
        dateDeleted: reviews.dateDeleted,
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
        appId: components.appId,
        userHash: users.userHash,
        userId: reviews.userId,
        componentId: reviews.componentId,
      })
      .from(reviews)
      .innerJoin(components, eq(reviews.componentId, components.componentId))
      .leftJoin(users, eq(reviews.userId, users.userId))
      .orderBy(desc(reviews.dateCreated))
      .$dynamic();

    // Count query
    let countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .innerJoin(components, eq(reviews.componentId, components.componentId))
      .leftJoin(users, eq(reviews.userId, users.userId))
      .$dynamic();

    if (filter === "reported") {
      query = query.where(sql`${reviews.reported} >= 1`);
      countQuery = countQuery.where(sql`${reviews.reported} >= 1`);
    }

    const [countResult] = await countQuery;
    const total = Number(countResult?.count ?? 0);

    const rows = await query.limit(perPage).offset((page - 1) * perPage);

    return c.json({
      success: true,
      reviews: rows.map((r) => ({
        review_id: r.reviewId,
        date_created: r.dateCreated.toISOString(),
        date_deleted: r.dateDeleted?.toISOString() ?? null,
        locale: r.locale,
        summary: r.summary,
        description: r.description,
        user_display: r.userDisplay,
        version: r.version,
        distro: r.distro,
        rating: r.rating,
        karma_up: r.karmaUp,
        karma_down: r.karmaDown,
        reported: r.reported,
        app_id: r.appId,
        user_hash: r.userHash,
        user_id: r.userId,
      })),
      pagination: {
        page,
        per_page: perPage,
        total,
        pages: Math.ceil(total / perPage),
      },
    });
  },
);

// ─── GET /reviews/search?value=... — search reviews ─────────────────────────

app.get(
  "/search",
  adminReviewDesc(
    "Search reviews",
    "Search reviews by user display name, summary, or description.",
    AdminReviewListResponse,
  ),
  validator("query", AdminReviewSearchQuery),
  async (c) => {
    const q = c.req.valid("query");
    const value = q.value;
    const maxResults = q.max ?? 19;

    if (!value) {
      return c.json({ success: true, reviews: [] });
    }

    const keys = value.split(" ").filter(Boolean);
    if (keys.length === 0) {
      return c.json({ success: true, reviews: [] });
    }

    // Build OR conditions for each key across user_display, summary, description
    const conditions = keys.flatMap((key) => [
      like(reviews.userDisplay, `%${key}%`),
      like(reviews.summary, `%${key}%`),
      like(reviews.description, `%${key}%`),
    ]);

    const rows = await db
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
        appId: components.appId,
        userHash: users.userHash,
      })
      .from(reviews)
      .innerJoin(components, eq(reviews.componentId, components.componentId))
      .leftJoin(users, eq(reviews.userId, users.userId))
      .where(or(...conditions))
      .orderBy(desc(reviews.dateCreated))
      .limit(maxResults);

    return c.json({
      success: true,
      reviews: rows.map((r) => ({
        review_id: r.reviewId,
        date_created: r.dateCreated.toISOString(),
        locale: r.locale,
        summary: r.summary,
        description: r.description,
        user_display: r.userDisplay,
        version: r.version,
        distro: r.distro,
        rating: r.rating,
        karma_up: r.karmaUp,
        karma_down: r.karmaDown,
        reported: r.reported,
        app_id: r.appId,
        user_hash: r.userHash,
      })),
    });
  },
);

// ─── GET /reviews/:review_id — single review detail ─────────────────────────

app.get(
  "/:review_id",
  adminReviewDesc(
    "Get review detail",
    "Get full review detail including taboo matches and moderator vote status.",
    AdminReviewDetailResponse,
  ),
  async (c) => {
    const reviewId = Number.parseInt(c.req.param("review_id"), 10);
    if (Number.isNaN(reviewId)) {
      return c.json({ success: false, msg: "invalid review_id" }, 400);
    }

    const [row] = await db
      .select({
        reviewId: reviews.reviewId,
        dateCreated: reviews.dateCreated,
        dateDeleted: reviews.dateDeleted,
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
        userAddrHash: reviews.userAddrHash,
        appId: components.appId,
        userHash: users.userHash,
        userId: reviews.userId,
        componentId: reviews.componentId,
      })
      .from(reviews)
      .innerJoin(components, eq(reviews.componentId, components.componentId))
      .leftJoin(users, eq(reviews.userId, users.userId))
      .where(eq(reviews.reviewId, reviewId))
      .limit(1);

    if (!row) {
      return c.json({ success: false, msg: "review not found" }, 404);
    }

    // Check if the moderator has already voted (if they have a linked user)
    const mod = getModerator(c);
    let voteStatus: number | null = null;
    if (mod.userId) {
      const hasVoted = await voteExists(reviewId, mod.userId);
      if (hasVoted) {
        // Fetch the actual vote value
        const [vote] = await db
          .select({ val: votes.val })
          .from(votes)
          .where(
            and(eq(votes.reviewId, reviewId), eq(votes.userId, mod.userId)),
          )
          .limit(1);
        voteStatus = vote?.val ?? null;
      }
    }

    // Check taboo matches
    const tabooRows = row.locale ? await getTaboosForLocale(row.locale) : [];
    const tabooSet = new Set(tabooRows.map((t) => t.value));
    const matchedTaboos: string[] = [];

    const tokens = new Set<string>();
    if (row.summary) for (const t of tokenize(row.summary)) tokens.add(t);
    if (row.description)
      for (const t of tokenize(row.description)) tokens.add(t);
    if (row.userDisplay)
      for (const t of tokenize(row.userDisplay)) tokens.add(t);

    for (const token of tokens) {
      if (tabooSet.has(token)) matchedTaboos.push(token);
    }

    return c.json({
      success: true,
      review: {
        review_id: row.reviewId,
        date_created: row.dateCreated.toISOString(),
        date_deleted: row.dateDeleted?.toISOString() ?? null,
        locale: row.locale,
        summary: row.summary,
        description: row.description,
        user_display: row.userDisplay,
        version: row.version,
        distro: row.distro,
        rating: row.rating,
        karma_up: row.karmaUp,
        karma_down: row.karmaDown,
        reported: row.reported,
        user_addr_hash: row.userAddrHash,
        app_id: row.appId,
        user_hash: row.userHash,
        user_id: row.userId,
        component_id: row.componentId,
      },
      vote_exists: voteStatus,
      matched_taboos: matchedTaboos,
    });
  },
);

// ─── PUT /reviews/:review_id — modify a review ─────────────────────────────

app.put(
  "/:review_id",
  adminReviewDesc(
    "Modify a review",
    "Update review fields (summary, description, version, distro, locale, user_display).",
  ),
  validator("json", AdminReviewModifyRequest),
  async (c) => {
    const reviewId = Number.parseInt(c.req.param("review_id"), 10);
    if (Number.isNaN(reviewId)) {
      return c.json({ success: false, msg: "invalid review_id" }, 400);
    }

    const body = c.req.valid("json");

    const updates: Record<string, unknown> = {};
    if (body.distro !== undefined) updates.distro = body.distro;
    if (body.locale !== undefined) updates.locale = body.locale;
    if (body.user_display !== undefined)
      updates.userDisplay = body.user_display || null;
    if (body.description !== undefined) updates.description = body.description;
    if (body.summary !== undefined) updates.summary = body.summary;
    if (body.version !== undefined) updates.version = body.version;

    if (Object.keys(updates).length === 0) {
      return c.json({ success: false, msg: "no fields to update" }, 400);
    }

    const [existing] = await db
      .select({ reviewId: reviews.reviewId })
      .from(reviews)
      .where(eq(reviews.reviewId, reviewId))
      .limit(1);

    if (!existing) {
      return c.json({ success: false, msg: "review not found" }, 404);
    }

    await db.update(reviews).set(updates).where(eq(reviews.reviewId, reviewId));
    return c.json({ success: true, msg: "review updated" });
  },
);

// ─── POST /reviews/:review_id/unreport — reset reported count ───────────────

app.post(
  "/:review_id/unreport",
  adminReviewDesc("Unreport a review", "Reset the reported count back to 0."),
  async (c) => {
    const reviewId = Number.parseInt(c.req.param("review_id"), 10);
    if (Number.isNaN(reviewId)) {
      return c.json({ success: false, msg: "invalid review_id" }, 400);
    }

    const [existing] = await db
      .select({ reviewId: reviews.reviewId })
      .from(reviews)
      .where(eq(reviews.reviewId, reviewId))
      .limit(1);

    if (!existing) {
      return c.json({ success: false, msg: "review not found" }, 404);
    }

    await db
      .update(reviews)
      .set({ reported: 0 })
      .where(eq(reviews.reviewId, reviewId));
    return c.json({ success: true, msg: "review unreported" });
  },
);

// ─── POST /reviews/:review_id/unremove — restore a deleted review ───────────

app.post(
  "/:review_id/unremove",
  adminReviewDesc(
    "Restore a deleted review",
    "Clear the date_deleted field to make the review active again.",
  ),
  async (c) => {
    const reviewId = Number.parseInt(c.req.param("review_id"), 10);
    if (Number.isNaN(reviewId)) {
      return c.json({ success: false, msg: "invalid review_id" }, 400);
    }

    const [existing] = await db
      .select({ reviewId: reviews.reviewId })
      .from(reviews)
      .where(eq(reviews.reviewId, reviewId))
      .limit(1);

    if (!existing) {
      return c.json({ success: false, msg: "review not found" }, 404);
    }

    await db
      .update(reviews)
      .set({ dateDeleted: null })
      .where(eq(reviews.reviewId, reviewId));
    return c.json({ success: true, msg: "review unremoved" });
  },
);

// ─── POST /reviews/:review_id/englishify — mark as English locale ───────────

app.post(
  "/:review_id/englishify",
  adminReviewDesc("Mark review as English", "Set the review locale to en."),
  async (c) => {
    const reviewId = Number.parseInt(c.req.param("review_id"), 10);
    if (Number.isNaN(reviewId)) {
      return c.json({ success: false, msg: "invalid review_id" }, 400);
    }

    const [existing] = await db
      .select({ reviewId: reviews.reviewId, locale: reviews.locale })
      .from(reviews)
      .where(eq(reviews.reviewId, reviewId))
      .limit(1);

    if (!existing) {
      return c.json({ success: false, msg: "review not found" }, 404);
    }

    const parts = (existing.locale ?? "en").split("_");
    const newLocale = parts.length > 1 ? `en_${parts[1]}` : "en";

    await db
      .update(reviews)
      .set({ locale: newLocale })
      .where(eq(reviews.reviewId, reviewId));
    return c.json({ success: true, msg: "review marked as English" });
  },
);

// ─── POST /reviews/:review_id/anonify — remove username ────────────────

app.post(
  "/:review_id/anonify",
  adminReviewDesc(
    "Anonymise a review",
    "Remove the user display name from the review.",
  ),
  async (c) => {
    const reviewId = Number.parseInt(c.req.param("review_id"), 10);
    if (Number.isNaN(reviewId)) {
      return c.json({ success: false, msg: "invalid review_id" }, 400);
    }

    const [existing] = await db
      .select({ reviewId: reviews.reviewId })
      .from(reviews)
      .where(eq(reviews.reviewId, reviewId))
      .limit(1);

    if (!existing) {
      return c.json({ success: false, msg: "review not found" }, 404);
    }

    await db
      .update(reviews)
      .set({ userDisplay: null })
      .where(eq(reviews.reviewId, reviewId));
    return c.json({ success: true, msg: "review anonymised" });
  },
);

// ─── DELETE /reviews/:review_id — permanently delete a review ───────────

app.delete(
  "/:review_id",
  adminReviewDesc(
    "Delete a review",
    "Permanently delete a review and its associated votes.",
  ),
  async (c) => {
    const reviewId = Number.parseInt(c.req.param("review_id"), 10);
    if (Number.isNaN(reviewId)) {
      return c.json({ success: false, msg: "invalid review_id" }, 400);
    }

    const [existing] = await db
      .select({ reviewId: reviews.reviewId })
      .from(reviews)
      .where(eq(reviews.reviewId, reviewId))
      .limit(1);

    if (!existing) {
      return c.json({ success: false, msg: "review not found" }, 404);
    }

    // Delete associated votes first
    await db.delete(votes).where(eq(votes.reviewId, reviewId));
    await db.delete(reviews).where(eq(reviews.reviewId, reviewId));
    return c.json({ success: true, msg: "review deleted" });
  },
);

// ─── POST /reviews/:review_id/vote/:val — moderator vote ───────────────

app.post(
  "/:review_id/vote/:val",
  adminReviewDesc(
    "Vote on a review",
    "Cast a moderator vote (up, down, or meh) on a review.",
  ),
  async (c) => {
    const reviewId = Number.parseInt(c.req.param("review_id"), 10);
    const valStr = c.req.param("val");

    if (Number.isNaN(reviewId)) {
      return c.json({ success: false, msg: "invalid review_id" }, 400);
    }

    let val: number;
    if (valStr === "up") val = 1;
    else if (valStr === "down") val = -1;
    else if (valStr === "meh") val = 0;
    else {
      return c.json({ success: false, msg: "invalid vote value" }, 400);
    }

    const mod = getModerator(c);
    if (!mod.userId) {
      return c.json(
        { success: false, msg: "no user linked to moderator account" },
        400,
      );
    }

    // Check if already voted
    const hasVoted = await voteExists(reviewId, mod.userId);
    if (hasVoted) {
      return c.json(
        { success: false, msg: "already voted on this review" },
        409,
      );
    }

    // Update user karma
    await db
      .update(users)
      .set({ karma: sql`${users.karma} + ${val}` })
      .where(eq(users.userId, mod.userId));

    // Insert vote
    await db.insert(votes).values({
      reviewId,
      userId: mod.userId,
      val,
    });

    return c.json({ success: true, msg: "vote recorded" });
  },
);

// ─── GET /reviews/by-app/:app_id — reviews for a specific app ──────────────

app.get(
  "/by-app/:app_id",
  adminReviewDesc(
    "Reviews by app",
    "Get all reviews for a specific application.",
    AdminReviewListResponse,
  ),
  async (c) => {
    const appId = c.req.param("app_id");

    const rows = await db
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
        appId: components.appId,
        userHash: users.userHash,
      })
      .from(reviews)
      .innerJoin(components, eq(reviews.componentId, components.componentId))
      .leftJoin(users, eq(reviews.userId, users.userId))
      .where(eq(components.appId, appId))
      .orderBy(desc(reviews.dateCreated));

    return c.json({
      success: true,
      reviews: rows.map((r) => ({
        review_id: r.reviewId,
        date_created: r.dateCreated.toISOString(),
        locale: r.locale,
        summary: r.summary,
        description: r.description,
        user_display: r.userDisplay,
        version: r.version,
        distro: r.distro,
        rating: r.rating,
        karma_up: r.karmaUp,
        karma_down: r.karmaDown,
        reported: r.reported,
        app_id: r.appId,
        user_hash: r.userHash,
      })),
    });
  },
);

// ─── GET /reviews/by-user/:user_hash — reviews for a specific user ──────────

app.get(
  "/by-user/:user_hash",
  adminReviewDesc(
    "Reviews by user",
    "Get all reviews submitted by a specific user identified by their hash.",
    AdminReviewListResponse,
  ),
  async (c) => {
    const userHash = c.req.param("user_hash");

    const rows = await db
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
        appId: components.appId,
        userHash: users.userHash,
      })
      .from(reviews)
      .innerJoin(components, eq(reviews.componentId, components.componentId))
      .innerJoin(users, eq(reviews.userId, users.userId))
      .where(eq(users.userHash, userHash))
      .orderBy(desc(reviews.dateCreated));

    return c.json({
      success: true,
      reviews: rows.map((r) => ({
        review_id: r.reviewId,
        date_created: r.dateCreated.toISOString(),
        locale: r.locale,
        summary: r.summary,
        description: r.description,
        user_display: r.userDisplay,
        version: r.version,
        distro: r.distro,
        rating: r.rating,
        karma_up: r.karmaUp,
        karma_down: r.karmaDown,
        reported: r.reported,
        app_id: r.appId,
        user_hash: r.userHash,
      })),
    });
  },
);

// ─── GET /reviews/by-locale/:locale — reviews for a specific locale ─────────

app.get(
  "/by-locale/:locale",
  adminReviewDesc(
    "Reviews by locale",
    "Get all reviews for a specific locale.",
    AdminReviewListResponse,
  ),
  async (c) => {
    const locale = c.req.param("locale");

    const rows = await db
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
        appId: components.appId,
        userHash: users.userHash,
      })
      .from(reviews)
      .innerJoin(components, eq(reviews.componentId, components.componentId))
      .leftJoin(users, eq(reviews.userId, users.userId))
      .where(eq(reviews.locale, locale))
      .orderBy(desc(reviews.dateCreated));

    return c.json({
      success: true,
      reviews: rows.map((r) => ({
        review_id: r.reviewId,
        date_created: r.dateCreated.toISOString(),
        locale: r.locale,
        summary: r.summary,
        description: r.description,
        user_display: r.userDisplay,
        version: r.version,
        distro: r.distro,
        rating: r.rating,
        karma_up: r.karmaUp,
        karma_down: r.karmaDown,
        reported: r.reported,
        app_id: r.appId,
        user_hash: r.userHash,
      })),
    });
  },
);

export default app;
