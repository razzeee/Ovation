import type { Context, MiddlewareHandler } from "hono";
import { SignJWT, jwtVerify } from "jose";
import { config } from "../config.js";

/** JWT payload shape */
export interface JwtPayload {
	sub: number; // moderator_id
	username: string;
	displayName: string;
	isAdmin: boolean;
	isEnabled: boolean;
	userId: number | null;
	locales: string | null;
}

const secret = new TextEncoder().encode(config.jwt.secret);

/**
 * Create a signed JWT for a moderator.
 */
export async function signToken(payload: JwtPayload): Promise<string> {
	return new SignJWT(payload as unknown as Record<string, unknown>)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(config.jwt.expiresIn)
		.sign(secret);
}

/**
 * Verify and decode a JWT token.
 */
export async function verifyToken(token: string): Promise<JwtPayload> {
	const { payload } = await jwtVerify(token, secret);
	return payload as unknown as JwtPayload;
}

/**
 * Hono middleware: requires a valid JWT in the Authorization header.
 * Sets `c.set("moderator", payload)` on success.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
	const header = c.req.header("Authorization");
	if (!header?.startsWith("Bearer ")) {
		return c.json({ success: false, msg: "missing or invalid authorization header" }, 401);
	}

	try {
		const token = header.slice(7);
		const payload = await verifyToken(token);

		if (!payload.isEnabled) {
			return c.json({ success: false, msg: "account disabled" }, 403);
		}

		c.set("moderator", payload);
		await next();
	} catch {
		return c.json({ success: false, msg: "invalid or expired token" }, 401);
	}
};

/**
 * Hono middleware: requires the current moderator to be an admin.
 * Must be used AFTER requireAuth.
 */
export const requireAdmin: MiddlewareHandler = async (c, next) => {
	const mod = c.get("moderator") as JwtPayload | undefined;
	if (!mod?.isAdmin) {
		return c.json({ success: false, msg: "admin access required" }, 403);
	}
	await next();
};

/**
 * Helper to extract the moderator payload from the context.
 */
export function getModerator(c: Context): JwtPayload {
	return c.get("moderator") as JwtPayload;
}
