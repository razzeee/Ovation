import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password.js";
import { legacyPasswordHash } from "../src/lib/util.js";

describe("hashPassword", () => {
	it("produces a bcrypt hash", async () => {
		const hash = await hashPassword("testpassword");
		expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
	});

	it("produces different hashes for same input (salted)", async () => {
		const h1 = await hashPassword("testpassword");
		const h2 = await hashPassword("testpassword");
		expect(h1).not.toBe(h2);
	});
});

describe("verifyPassword", () => {
	it("verifies a bcrypt hash correctly", async () => {
		const hash = await hashPassword("mypassword");
		const result = await verifyPassword("mypassword", hash);
		expect(result.valid).toBe(true);
		expect(result.needsUpgrade).toBe(false);
	});

	it("rejects wrong password against bcrypt hash", async () => {
		const hash = await hashPassword("mypassword");
		const result = await verifyPassword("wrongpassword", hash);
		expect(result.valid).toBe(false);
	});

	it("verifies legacy SHA1 hash and flags for upgrade", async () => {
		const legacyHash = legacyPasswordHash("foo");
		expect(legacyHash).toHaveLength(40);

		const result = await verifyPassword("foo", legacyHash);
		expect(result.valid).toBe(true);
		expect(result.needsUpgrade).toBe(true);
		expect(result.newHash).toBeDefined();
		expect(result.newHash).toMatch(/^\$2[aby]\$/); // upgraded to bcrypt
	});

	it("rejects wrong password against legacy hash", async () => {
		const legacyHash = legacyPasswordHash("foo");
		const result = await verifyPassword("bar", legacyHash);
		expect(result.valid).toBe(false);
		expect(result.needsUpgrade).toBe(false);
	});
});
