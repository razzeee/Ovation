import { asc, desc, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { db } from "../db/index.js";
import { components, reviews, votes } from "../db/schema.js";
import {
  ComponentsListResponse,
  ErrorResponse,
  JoinComponentsRequest,
  SuccessMsg,
} from "../openapi/schemas.js";
import { requireAdmin, requireAuth } from "./auth.js";

const app = new Hono();

// All routes require auth + admin
app.use("*", requireAuth);
app.use("*", requireAdmin);

const compDesc = (
  summary: string,
  description: string,
  responseSchema: import("zod").ZodType = SuccessMsg,
) =>
  describeRoute({
    tags: ["Admin Components"],
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

// ─── GET /components — list all components ──────────────────────────────────

app.get(
  "/",
  compDesc(
    "List components",
    "List all known AppStream components.",
    ComponentsListResponse,
  ),
  async (c) => {
    const rows = await db
      .select()
      .from(components)
      .orderBy(asc(components.appId), asc(components.reviewCnt));

    return c.json({
      success: true,
      components: rows.map((comp) => ({
        component_id: comp.componentId,
        component_id_parent: comp.componentIdParent,
        app_id: comp.appId,
        fetch_cnt: comp.fetchCnt,
        review_cnt: comp.reviewCnt,
      })),
    });
  },
);

// ─── POST /components/join — join parent + children ─────────────────────────

app.post(
  "/join",
  compDesc(
    "Join components",
    "Set a parent component for one or more children, adopting grandchildren.",
  ),
  validator("json", JoinComponentsRequest),
  async (c) => {
    const body = c.req.valid("json");

    const [parent] = await db
      .select()
      .from(components)
      .where(eq(components.appId, body.parent))
      .limit(1);

    if (!parent) {
      return c.json({ success: false, msg: "parent component not found" }, 404);
    }

    let adopted = 0;
    for (const childId of body.children) {
      const [child] = await db
        .select()
        .from(components)
        .where(eq(components.appId, childId))
        .limit(1);

      if (!child) continue;
      if (child.componentId === parent.componentId) {
        // Can't be own parent — clear parent ref if set
        await db
          .update(components)
          .set({ componentIdParent: null })
          .where(eq(components.componentId, child.componentId));
        continue;
      }
      if (child.componentIdParent === parent.componentId) continue; // Already joined

      // Set the child's parent
      await db
        .update(components)
        .set({ componentIdParent: parent.componentId })
        .where(eq(components.componentId, child.componentId));

      // Adopt grandchildren: any component whose parent is the child
      const grandchildren = await db
        .select({ componentId: components.componentId })
        .from(components)
        .where(eq(components.componentIdParent, child.componentId));

      for (const gc of grandchildren) {
        await db
          .update(components)
          .set({ componentIdParent: parent.componentId })
          .where(eq(components.componentId, gc.componentId));
        adopted++;
      }
      adopted++;
    }

    return c.json({
      success: true,
      msg: `joined ${body.children.length} components, adopted ${adopted} total`,
    });
  },
);

// ─── DELETE /components/:id — delete component and its reviews ──────────────

app.delete(
  "/:component_id",
  compDesc("Delete component", "Delete a component and all its reviews/votes."),
  async (c) => {
    const componentId = Number.parseInt(c.req.param("component_id"), 10);
    if (Number.isNaN(componentId)) {
      return c.json({ success: false, msg: "invalid component_id" }, 400);
    }

    const [comp] = await db
      .select()
      .from(components)
      .where(eq(components.componentId, componentId))
      .limit(1);

    if (!comp) {
      return c.json({ success: false, msg: "component not found" }, 404);
    }

    // Get review IDs for this component
    const reviewRows = await db
      .select({ reviewId: reviews.reviewId })
      .from(reviews)
      .where(eq(reviews.componentId, componentId));

    const reviewIds = reviewRows.map((r) => r.reviewId);

    // Delete votes for those reviews
    if (reviewIds.length > 0) {
      for (const rid of reviewIds) {
        await db.delete(votes).where(eq(votes.reviewId, rid));
      }
    }

    // Delete reviews
    await db.delete(reviews).where(eq(reviews.componentId, componentId));

    // Orphan any children first
    await db
      .update(components)
      .set({ componentIdParent: null })
      .where(eq(components.componentIdParent, componentId));

    // Delete component
    await db.delete(components).where(eq(components.componentId, componentId));

    return c.json({
      success: true,
      msg: `deleted component with ${reviewIds.length} reviews`,
    });
  },
);

export default app;
