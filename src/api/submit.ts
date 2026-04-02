import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { db } from "../db/index.js";
import { components, reviews, users } from "../db/schema.js";
import {
  ErrorResponse,
  SubmitRequest,
  SubmitResponse,
} from "../openapi/schemas.js";
import {
  addrHash,
  checkStr,
  sanitisedDescription,
  sanitisedSummary,
  sanitisedVersion,
} from "../lib/util.js";
import { jsonError } from "../middleware/error.js";
import {
  USER_DISPLAY_IGNORE,
  eventlogAdd,
  getClientAddress,
  matchesTaboos,
} from "./helpers.js";

const app = new Hono();

app.post(
  "/",
  describeRoute({
    tags: ["Reviews"],
    summary: "Submit a review",
    description:
      "Submit a new application review. Each user can only review an application once. Reviews are checked against taboo word lists.",
    responses: {
      200: {
        description: "Review submitted successfully",
        content: { "application/json": { schema: resolver(SubmitResponse) } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: resolver(ErrorResponse) } },
      },
    },
  }),
  validator("json", SubmitRequest),
  async (c) => {
    const body = c.req.valid("json");

    // Check user ban status (or create user)
    let user = await db
      .select()
      .from(users)
      .where(eq(users.userHash, body.user_hash))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (user) {
      if (user.isBanned) {
        return jsonError(c, "account has been disabled due to abuse");
      }
    } else {
      const [newUser] = await db
        .insert(users)
        .values({ userHash: body.user_hash })
        .returning();
      user = newUser;
    }

    // Check if user already reviewed this app
    const existingReview = await db
      .select({ reviewId: reviews.reviewId })
      .from(reviews)
      .innerJoin(components, eq(reviews.componentId, components.componentId))
      .where(
        and(eq(components.appId, body.app_id), eq(reviews.userId, user.userId)),
      )
      .limit(1);

    if (existingReview.length > 0) {
      await eventlogAdd(
        getClientAddress(c),
        user.userId,
        body.app_id,
        "already reviewed",
      );
      return jsonError(c, "already reviewed this app");
    }

    // Find or create component
    let component = await db
      .select()
      .from(components)
      .where(eq(components.appId, body.app_id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (component) {
      await db
        .update(components)
        .set({ reviewCnt: (component.reviewCnt ?? 0) + 1 })
        .where(eq(components.componentId, component.componentId));
    } else {
      const [newComponent] = await db
        .insert(components)
        .values({ appId: body.app_id })
        .returning();
      component = newComponent;
    }

    // Sanitize inputs
    const summary = sanitisedSummary(body.summary);
    if (summary.length < 2) {
      return jsonError(c, "summary is too short");
    }
    const description = sanitisedDescription(body.description);
    if (description.length < 2) {
      return jsonError(c, "description is too short");
    }

    const version = sanitisedVersion(body.version);
    const rating = body.rating;

    // Validate rating range
    if (rating < 1 || rating > 100) {
      return jsonError(
        c,
        `review contains invalid rating '${rating}', expected 1 to 100`,
      );
    }

    // Determine user display name
    let userDisplay: string | null = body.user_display;
    if (USER_DISPLAY_IGNORE.has(body.user_display)) {
      userDisplay = null;
    }

    // Check for taboos
    if (
      await matchesTaboos(
        body.locale,
        summary,
        description,
        userDisplay ?? undefined,
      )
    ) {
      return jsonError(c, "review contains taboo word");
    }

    // Insert the review
    const clientAddr = getClientAddress(c);
    const [review] = await db
      .insert(reviews)
      .values({
        componentId: component.componentId,
        locale: body.locale,
        summary,
        description,
        userId: user.userId,
        userAddrHash: addrHash(clientAddr),
        userDisplay,
        version,
        distro: body.distro,
        rating,
      })
      .returning({ reviewId: reviews.reviewId });

    // Log the event
    await eventlogAdd(clientAddr, user.userId, component.appId, "reviewed");

    return c.json({ success: true, review_id: review.reviewId });
  },
);

export default app;
