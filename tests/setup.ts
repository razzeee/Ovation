/**
 * Vitest global setup.
 *
 * Sets environment variables for test mode so the config module picks
 * them up. We do NOT import the actual DB here — individual test files
 * decide whether they need a real DB connection.
 */

// Force test environment
process.env.NODE_ENV = "test";
process.env.REVIEWS_SECRET = "1";
process.env.JWT_SECRET = "test-secret";
process.env.SENTRY_DSN = ""; // Disable Sentry in tests
