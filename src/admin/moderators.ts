import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { db } from "../db/index.js";
import { moderators, users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  AddModeratorRequest,
  AddModeratorResponse,
  ErrorResponse,
  ModeratorDetailResponse,
  ModeratorsListResponse,
  SuccessMsg,
  UpdateModeratorRequest,
} from "../openapi/schemas.js";
import { getModerator, requireAdmin, requireAuth } from "./auth.js";

const app = new Hono();

// All routes require authentication
app.use("*", requireAuth);

const modDesc = (
  summary: string,
  description: string,
  responseSchema: import("zod").ZodType = SuccessMsg,
) =>
  describeRoute({
    tags: ["Admin Moderators"],
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

// ─── GET /moderators — list all moderators [ADMIN ONLY] ─────────────────────

app.get(
  "/",
  requireAdmin,
  modDesc(
    "List moderators",
    "List all moderator accounts. Requires admin.",
    ModeratorsListResponse,
  ),
  async (c) => {
    const rows = await db
      .select({
        moderatorId: moderators.moderatorId,
        username: moderators.username,
        displayName: moderators.displayName,
        isEnabled: moderators.isEnabled,
        isAdmin: moderators.isAdmin,
        locales: moderators.locales,
        userId: moderators.userId,
      })
      .from(moderators)
      .orderBy(moderators.username);

    return c.json({
      success: true,
      moderators: rows.map((m) => ({
        moderator_id: m.moderatorId,
        username: m.username,
        display_name: m.displayName,
        is_enabled: m.isEnabled,
        is_admin: m.isAdmin,
        locales: m.locales,
        user_id: m.userId,
      })),
    });
  },
);

// ─── GET /moderators/:id — single moderator detail ──────────────────────────

app.get(
  "/:moderator_id",
  modDesc(
    "Get moderator detail",
    "Get a single moderator by ID. Admins can view any; non-admins can only view themselves.",
    ModeratorDetailResponse,
  ),
  async (c) => {
    const moderatorId = Number.parseInt(c.req.param("moderator_id"), 10);
    if (Number.isNaN(moderatorId)) {
      return c.json({ success: false, msg: "invalid moderator_id" }, 400);
    }

    const mod = getModerator(c);
    // Only the moderator themselves or an admin can view details
    if (moderatorId !== mod.sub && !mod.isAdmin) {
      return c.json({ success: false, msg: "access denied" }, 403);
    }

    const [row] = await db
      .select({
        moderatorId: moderators.moderatorId,
        username: moderators.username,
        displayName: moderators.displayName,
        isEnabled: moderators.isEnabled,
        isAdmin: moderators.isAdmin,
        locales: moderators.locales,
        userId: moderators.userId,
      })
      .from(moderators)
      .where(eq(moderators.moderatorId, moderatorId))
      .limit(1);

    if (!row) {
      return c.json({ success: false, msg: "moderator not found" }, 404);
    }

    // Also fetch the linked user's hash if present
    let userHash: string | null = null;
    if (row.userId) {
      const [user] = await db
        .select({ userHash: users.userHash })
        .from(users)
        .where(eq(users.userId, row.userId))
        .limit(1);
      userHash = user?.userHash ?? null;
    }

    return c.json({
      success: true,
      moderator: {
        moderator_id: row.moderatorId,
        username: row.username,
        display_name: row.displayName,
        is_enabled: row.isEnabled,
        is_admin: row.isAdmin,
        locales: row.locales,
        user_id: row.userId,
        user_hash: userHash,
      },
    });
  },
);

// ─── POST /moderators — add a new moderator [ADMIN ONLY] ───────────────────

app.post(
  "/",
  requireAdmin,
  modDesc(
    "Add moderator",
    "Create a new moderator account. Requires admin.",
    AddModeratorResponse,
  ),
  validator("json", AddModeratorRequest),
  async (c) => {
    const body = c.req.valid("json");

    // Validate email
    if (!body.username.includes("@") || !body.username.includes(".")) {
      return c.json({ success: false, msg: "invalid email address" }, 400);
    }

    // Check for duplicate username
    const [existing] = await db
      .select({ moderatorId: moderators.moderatorId })
      .from(moderators)
      .where(eq(moderators.username, body.username))
      .limit(1);

    if (existing) {
      return c.json({ success: false, msg: "username already exists" }, 409);
    }

    const passwordHash = await hashPassword(body.password);

    const [inserted] = await db
      .insert(moderators)
      .values({
        username: body.username,
        passwordHash,
        displayName: body.display_name,
        isEnabled: true,
        isAdmin: false,
      })
      .returning({ moderatorId: moderators.moderatorId });

    return c.json(
      {
        success: true,
        msg: "moderator added",
        moderator_id: inserted.moderatorId,
      },
      201,
    );
  },
);

// ─── PUT /moderators/:id — update moderator [ADMIN or SELF] ────────────────

app.put(
  "/:moderator_id",
  modDesc(
    "Update moderator",
    "Update moderator fields. Admins can update any moderator; non-admins can only update themselves.",
  ),
  validator("json", UpdateModeratorRequest),
  async (c) => {
    const moderatorId = Number.parseInt(c.req.param("moderator_id"), 10);
    if (Number.isNaN(moderatorId)) {
      return c.json({ success: false, msg: "invalid moderator_id" }, 400);
    }

    const mod = getModerator(c);
    if (moderatorId !== mod.sub && !mod.isAdmin) {
      return c.json({ success: false, msg: "access denied" }, 403);
    }

    const body = c.req.valid("json");

    const [existing] = await db
      .select()
      .from(moderators)
      .where(eq(moderators.moderatorId, moderatorId))
      .limit(1);

    if (!existing) {
      return c.json({ success: false, msg: "moderator not found" }, 404);
    }

    const updates: Record<string, unknown> = {};

    if (body.display_name !== undefined)
      updates.displayName = body.display_name;
    if (body.locales !== undefined) updates.locales = body.locales;

    // Only admins can toggle these flags
    if (mod.isAdmin) {
      if (body.is_enabled !== undefined) updates.isEnabled = body.is_enabled;
      if (body.is_admin !== undefined) updates.isAdmin = body.is_admin;
    }

    // Handle user_hash linking
    if (body.user_hash !== undefined) {
      if (body.user_hash) {
        // Find or create user by hash
        let [user] = await db
          .select({ userId: users.userId })
          .from(users)
          .where(eq(users.userHash, body.user_hash))
          .limit(1);

        if (!user) {
          [user] = await db
            .insert(users)
            .values({ userHash: body.user_hash })
            .returning({ userId: users.userId });
        }
        updates.userId = user.userId;
      } else {
        updates.userId = null;
      }
    }

    // Handle password change
    if (body.password && body.password.length > 0) {
      if (body.password.length < 8) {
        return c.json(
          { success: false, msg: "password must be at least 8 characters" },
          400,
        );
      }
      if (/^[a-zA-Z0-9]+$/.test(body.password)) {
        return c.json(
          {
            success: false,
            msg: "password requires at least one non-alphanumeric character",
          },
          400,
        );
      }
      updates.passwordHash = await hashPassword(body.password);
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ success: false, msg: "no fields to update" }, 400);
    }

    await db
      .update(moderators)
      .set(updates)
      .where(eq(moderators.moderatorId, moderatorId));
    return c.json({ success: true, msg: "moderator updated" });
  },
);

// ─── DELETE /moderators/:id — delete moderator [ADMIN ONLY] ─────────────────

app.delete(
  "/:moderator_id",
  requireAdmin,
  modDesc("Delete moderator", "Delete a moderator account. Requires admin."),
  async (c) => {
    const moderatorId = Number.parseInt(c.req.param("moderator_id"), 10);
    if (Number.isNaN(moderatorId)) {
      return c.json({ success: false, msg: "invalid moderator_id" }, 400);
    }

    const [existing] = await db
      .select({ moderatorId: moderators.moderatorId })
      .from(moderators)
      .where(eq(moderators.moderatorId, moderatorId))
      .limit(1);

    if (!existing) {
      return c.json({ success: false, msg: "moderator not found" }, 404);
    }

    await db.delete(moderators).where(eq(moderators.moderatorId, moderatorId));
    return c.json({ success: true, msg: "moderator deleted" });
  },
);

export default app;
