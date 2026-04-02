import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { db } from "../db/index.js";
import { moderators } from "../db/schema.js";
import { verifyPassword } from "../lib/password.js";
import {
  ErrorResponse,
  LoginRequest,
  LoginResponse,
} from "../openapi/schemas.js";
import { signToken } from "./auth.js";
import type { JwtPayload } from "./auth.js";

const app = new Hono();

/**
 * POST /admin/api/login
 * Body: { username, password }
 * Returns: { success, token, moderator }
 */
app.post(
  "/login",
  describeRoute({
    tags: ["Admin Auth"],
    summary: "Admin login",
    description:
      "Authenticate with username and password to obtain a JWT token for admin API access.",
    responses: {
      200: {
        description: "Login successful",
        content: { "application/json": { schema: resolver(LoginResponse) } },
      },
      400: {
        description: "Missing fields",
        content: { "application/json": { schema: resolver(ErrorResponse) } },
      },
      401: {
        description: "Invalid credentials",
        content: { "application/json": { schema: resolver(ErrorResponse) } },
      },
    },
  }),
  validator("json", LoginRequest),
  async (c) => {
    const body = c.req.valid("json");

    const [mod] = await db
      .select()
      .from(moderators)
      .where(eq(moderators.username, body.username))
      .limit(1);

    if (!mod) {
      return c.json(
        { success: false, msg: "incorrect username or password" },
        401,
      );
    }

    if (!mod.passwordHash) {
      return c.json(
        { success: false, msg: "incorrect username or password" },
        401,
      );
    }

    const result = await verifyPassword(body.password, mod.passwordHash);
    if (!result.valid) {
      return c.json(
        { success: false, msg: "incorrect username or password" },
        401,
      );
    }

    // Auto-upgrade legacy password hash to bcrypt
    if (result.needsUpgrade && result.newHash) {
      await db
        .update(moderators)
        .set({ passwordHash: result.newHash })
        .where(eq(moderators.moderatorId, mod.moderatorId));
    }

    if (!mod.isEnabled) {
      return c.json({ success: false, msg: "account disabled" }, 403);
    }

    const payload: JwtPayload = {
      sub: mod.moderatorId,
      username: mod.username ?? "",
      displayName: mod.displayName ?? "",
      isAdmin: mod.isAdmin ?? false,
      isEnabled: mod.isEnabled ?? false,
      userId: mod.userId,
      locales: mod.locales,
    };

    const token = await signToken(payload);

    return c.json({
      success: true,
      token,
      moderator: {
        moderator_id: mod.moderatorId,
        username: mod.username,
        display_name: mod.displayName,
        is_admin: mod.isAdmin,
        is_enabled: mod.isEnabled,
        locales: mod.locales,
      },
    });
  },
);

export default app;
