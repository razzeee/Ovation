import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { db } from "../db/index.js";
import { taboos } from "../db/schema.js";
import {
  AddTabooRequest,
  AddTabooResponse,
  ErrorResponse,
  SuccessMsg,
  TaboosListResponse,
} from "../openapi/schemas.js";
import { requireAdmin, requireAuth } from "./auth.js";

const app = new Hono();

// All routes require auth + admin
app.use("*", requireAuth);
app.use("*", requireAdmin);

const tabooDesc = (
  summary: string,
  description: string,
  responseSchema: import("zod").ZodType = SuccessMsg,
) =>
  describeRoute({
    tags: ["Admin Taboos"],
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

// ─── GET /taboos — list all taboos ──────────────────────────────────────

app.get(
  "/",
  tabooDesc("List taboos", "List all taboo words/phrases.", TaboosListResponse),
  async (c) => {
    const rows = await db
      .select()
      .from(taboos)
      .orderBy(asc(taboos.locale), asc(taboos.value));

    return c.json({
      success: true,
      taboos: rows.map((t) => ({
        taboo_id: t.tabooId,
        locale: t.locale,
        value: t.value,
        description: t.description,
        severity: t.severity,
      })),
    });
  },
);

// ─── POST /taboos — add a taboo ────────────────────────────────────────────

app.post(
  "/",
  tabooDesc("Add taboo", "Add a new taboo word or phrase.", AddTabooResponse),
  validator("json", AddTabooRequest),
  async (c) => {
    const body = c.req.valid("json");

    // Check for duplicate
    const [existing] = await db
      .select({ tabooId: taboos.tabooId })
      .from(taboos)
      .where(and(eq(taboos.locale, body.locale), eq(taboos.value, body.value)))
      .limit(1);

    if (existing) {
      return c.json({ success: false, msg: "taboo already exists" }, 409);
    }

    const [inserted] = await db
      .insert(taboos)
      .values({
        locale: body.locale,
        value: body.value,
        description: body.description ?? null,
        severity: body.severity ?? 0,
      })
      .returning({ tabooId: taboos.tabooId });

    return c.json(
      {
        success: true,
        msg: "taboo added",
        taboo_id: inserted.tabooId,
      },
      201,
    );
  },
);

// ─── DELETE /taboos/:id — delete a taboo ────────────────────────────────────

app.delete(
  "/:taboo_id",
  tabooDesc("Delete taboo", "Delete a taboo by ID.", SuccessMsg, {
    parameters: [
      {
        name: "taboo_id",
        in: "path",
        required: true,
        schema: { type: "integer" },
      },
    ],
  }),
  async (c) => {
    const tabooId = Number.parseInt(c.req.param("taboo_id"), 10);
    if (Number.isNaN(tabooId)) {
      return c.json({ success: false, msg: "invalid taboo_id" }, 400);
    }

    const [existing] = await db
      .select({ tabooId: taboos.tabooId })
      .from(taboos)
      .where(eq(taboos.tabooId, tabooId))
      .limit(1);

    if (!existing) {
      return c.json({ success: false, msg: "taboo not found" }, 404);
    }

    await db.delete(taboos).where(eq(taboos.tabooId, tabooId));
    return c.json({ success: true, msg: "taboo deleted" });
  },
);

export default app;
