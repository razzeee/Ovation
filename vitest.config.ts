import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["./tests/setup.ts"],
		include: ["tests/**/*.test.ts"],
		testTimeout: 30000,
		pool: "forks",
	},
	resolve: {
		alias: {
			"@": "./src",
			// Replace the Bun-specific hono adapter with a no-op stub for tests.
			// serveStatic is only used for production static-file serving and
			// references the Bun global which is not available under Node/Vitest.
			"hono/bun": new URL("./tests/mocks/hono-bun.ts", import.meta.url).pathname,
		},
	},
});
