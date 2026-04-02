/**
 * Stub for hono/bun used during Vitest runs under Node.
 *
 * The real hono/bun exports serveStatic which references the Bun global —
 * not available in Node/Vitest. We replace it with a no-op middleware so
 * route-wiring tests can import src/index.ts without crashing.
 *
 * Static file serving is not exercised in unit/integration tests anyway.
 */
import type { Context, MiddlewareHandler, Next } from "hono";

export const serveStatic =
	(_options?: unknown): MiddlewareHandler =>
	async (_c: Context, next: Next) => {
		await next();
	};
