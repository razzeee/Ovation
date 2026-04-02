import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Admin API integration tests.
 *
 * Tests the admin JWT auth flow and route wiring.
 * Database is mocked — these verify request/response contracts.
 */

// Mock the database module
vi.mock("../src/db/index.js", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		offset: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn().mockResolvedValue([]),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		query: {
			components: {
				findFirst: vi.fn().mockResolvedValue(null),
			},
		},
		$dynamic: vi.fn().mockReturnThis(),
		groupBy: vi.fn().mockReturnThis(),
		// biome-ignore lint/suspicious/noThenProperty: Drizzle queries are thenables; must call resolve() not return a Promise
		then: vi.fn().mockImplementation((resolve: (v: unknown[]) => void) => resolve([])),
	},
}));

// Mock Sentry
vi.mock("../src/instrument.js", () => ({
	Sentry: {
		isInitialized: () => false,
		init: vi.fn(),
		captureException: vi.fn(),
		withScope: vi.fn(),
	},
}));

const { default: app } = await import("../src/index.js");
const { signToken } = await import("../src/admin/auth.js");
import type { JwtPayload } from "../src/admin/auth.js";

/** Helper to parse JSON response with a concrete type. */
async function json(res: Response): Promise<Record<string, unknown>> {
	return (await res.json()) as Record<string, unknown>;
}

// Helper to create a valid admin JWT
async function adminToken(): Promise<string> {
	const payload: JwtPayload = {
		sub: 1,
		username: "admin@test.com",
		displayName: "Admin",
		isAdmin: true,
		isEnabled: true,
		userId: 1,
		locales: "en",
	};
	return signToken(payload);
}

// Helper to create a regular moderator JWT
async function moderatorToken(): Promise<string> {
	const payload: JwtPayload = {
		sub: 2,
		username: "mod@test.com",
		displayName: "Moderator",
		isAdmin: false,
		isEnabled: true,
		userId: 2,
		locales: "en",
	};
	return signToken(payload);
}

describe("Admin API — authentication", () => {
	it("rejects requests without Authorization header", async () => {
		const res = await app.request("/admin/api/reviews");
		expect(res.status).toBe(401);
		const body = await json(res);
		expect(body.success).toBe(false);
		expect(body.msg).toContain("authorization");
	});

	it("rejects requests with invalid token", async () => {
		const res = await app.request("/admin/api/reviews", {
			headers: { Authorization: "Bearer invalid-token" },
		});
		expect(res.status).toBe(401);
		const body = await json(res);
		expect(body.success).toBe(false);
	});

	it("rejects requests with malformed Authorization header", async () => {
		const res = await app.request("/admin/api/reviews", {
			headers: { Authorization: "NotBearer sometoken" },
		});
		expect(res.status).toBe(401);
	});
});

describe("Admin API — login endpoint", () => {
	it("POST /admin/api/login rejects missing fields", async () => {
		const res = await app.request("/admin/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(400);
		const body = await json(res);
		expect(body.success).toBe(false);
		expect(body.msg).toContain("username and password required");
	});
});

describe("Admin API — authorization levels", () => {
	it("non-admin cannot access stats", async () => {
		const token = await moderatorToken();
		const res = await app.request("/admin/api/stats", {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(403);
		const body = await json(res);
		expect(body.msg).toContain("admin access required");
	});

	it("non-admin cannot access taboos", async () => {
		const token = await moderatorToken();
		const res = await app.request("/admin/api/taboos", {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(403);
	});

	it("non-admin cannot access components", async () => {
		const token = await moderatorToken();
		const res = await app.request("/admin/api/components", {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(403);
	});

	it("non-admin cannot access users", async () => {
		const token = await moderatorToken();
		const res = await app.request("/admin/api/users/somehash", {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(403);
	});
});

describe("Admin API — JWT token generation", () => {
	it("signToken produces a valid JWT", async () => {
		const token = await adminToken();
		expect(typeof token).toBe("string");
		expect(token.split(".")).toHaveLength(3); // header.payload.signature
	});
});

describe("Admin API — CORS", () => {
	it("allows Authorization header for admin API", async () => {
		const res = await app.request("/admin/api/login", {
			method: "OPTIONS",
			headers: {
				Origin: "http://localhost:5173",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "Authorization, Content-Type",
			},
		});
		const allowHeaders = res.headers.get("Access-Control-Allow-Headers");
		expect(allowHeaders).toContain("Authorization");
	});
});
