import type { Context, MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { Sentry } from "../instrument.js";

/** Standard JSON error response matching the original service format */
export function jsonError(
  c: Context,
  msg: string,
  status: ContentfulStatusCode = 400,
): Response {
  return c.json({ success: false, msg }, status);
}

/** Standard JSON success response matching the original service format */
export function jsonSuccess(
  c: Context,
  msg?: string,
  status: ContentfulStatusCode = 200,
): Response {
  const body: Record<string, unknown> = { success: true };
  if (msg) body.msg = msg;
  return c.json(body, status);
}

/**
 * Global error handler middleware.
 * Catches unhandled exceptions, reports to Sentry, and returns a clean JSON error.
 */
export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "internal server error";
    console.error("[error]", message, err);
    Sentry.captureException(err);
    return jsonError(c, "internal server error", 500);
  }
};
