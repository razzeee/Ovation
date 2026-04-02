import * as Sentry from "@sentry/bun";
import { config } from "./config.js";

if (config.sentry.dsn) {
	Sentry.init({
		dsn: config.sentry.dsn,
		sendDefaultPii: true,
		tracesSampleRate: config.env === "production" ? 0.2 : 1.0,
		environment: config.env,
	});
}

export { Sentry };
