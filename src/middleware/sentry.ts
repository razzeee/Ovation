import type { MiddlewareHandler } from "hono";
import { Sentry } from "../instrument.js";

/**
 * Sentry tracing middleware for Hono.
 * Creates a transaction span for each incoming request and attaches user/route metadata.
 */
export const sentryMiddleware: MiddlewareHandler = async (c, next) => {
	if (!Sentry.isInitialized()) {
		return next();
	}

	return Sentry.withScope(async (scope) => {
		scope.setSDKProcessingMetadata({
			normalizedRequest: {
				method: c.req.method,
				url: c.req.url,
				headers: Object.fromEntries(c.req.raw.headers.entries()),
			},
		});

		try {
			await next();
		} catch (err) {
			Sentry.captureException(err);
			throw err;
		}
	});
};
