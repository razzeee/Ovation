import { describe, expect, it } from "vitest";
import { getReviewScore } from "../src/lib/review-score.js";
import {
	addrHash,
	checkStr,
	getDatestrFromDt,
	getUserKey,
	legacyPasswordHash,
	localeIsCompatible,
	sanitisedDescription,
	sanitisedSummary,
	sanitisedVersion,
	tokenize,
} from "../src/lib/util.js";
import { wilson } from "../src/lib/wilson.js";

// ─── Sanitisation ───────────────────────────────────────────────────────────

describe("sanitisedVersion", () => {
	it("leaves clean versions alone", () => {
		expect(sanitisedVersion("16.12.3")).toBe("16.12.3");
	});

	it("strips epoch prefix", () => {
		expect(sanitisedVersion("0:1.2.3+rh")).toBe("1.2.3");
	});

	it("strips distro suffix with tilde", () => {
		expect(sanitisedVersion("16.11.0~ds0")).toBe("16.11.0");
	});

	it("strips distro suffix with plus", () => {
		expect(sanitisedVersion("2.0+build1")).toBe("2.0");
	});

	it("strips both epoch and suffix", () => {
		expect(sanitisedVersion("2:1.2.3~dsg")).toBe("1.2.3");
	});
});

describe("sanitisedSummary", () => {
	it("trims whitespace and strips trailing period", () => {
		expect(sanitisedSummary("   not sure why people include.   ")).toBe(
			"not sure why people include",
		);
	});

	it("collapses double spaces", () => {
		expect(sanitisedSummary("hello  world")).toBe("hello world");
	});

	it("strips exclamation marks overflow", () => {
		expect(sanitisedSummary("amazing!!!")).toBe("amazing!");
	});
});

describe("sanitisedDescription", () => {
	it("trims and strips smileys", () => {
		expect(sanitisedDescription("   this is awesome :) !!   ")).toBe("this is awesome !!");
	});
});

// ─── Locale ─────────────────────────────────────────────────────────────────

describe("localeIsCompatible", () => {
	it("exact match", () => {
		expect(localeIsCompatible("en_GB", "en_GB")).toBe(true);
	});

	it("same language, different country", () => {
		expect(localeIsCompatible("en_GB", "en_AU")).toBe(true);
	});

	it("C is compatible with English", () => {
		expect(localeIsCompatible("en_GB", "C")).toBe(true);
		expect(localeIsCompatible("C", "en_GB")).toBe(true);
	});

	it("different languages are not compatible", () => {
		expect(localeIsCompatible("fr_FR", "en_GB")).toBe(false);
	});
});

// ─── User Key ───────────────────────────────────────────────────────────────

describe("getUserKey", () => {
	it("produces the expected SHA1 of secret+user_hash+app_id", () => {
		// SHA1("1" + "foo" + "gimp.desktop") with REVIEWS_SECRET="1" (set in setup.ts).
		// Verified independently via Node.js and Python hashlib.
		// Note: the Python util_test.py expected value was incorrect because app.secret_key
		// was not "1" at call time there (Flask sets it at import time, not on env-var change).
		expect(getUserKey("foo", "gimp.desktop")).toBe("74e9a6c58a608c88104efab48cc76beb271af1f1");
	});
});

// ─── Legacy Password Hash ───────────────────────────────────────────────────

describe("legacyPasswordHash", () => {
	it("matches the original Python implementation", () => {
		// Matches util_test.py: _password_hash("foo")
		expect(legacyPasswordHash("foo")).toBe("9cab340b3184a1f792d6629806703aed450ecd48");
	});
});

// ─── Addr Hash ──────────────────────────────────────────────────────────────

describe("addrHash", () => {
	it("produces a consistent SHA1 hash", () => {
		const h1 = addrHash("192.168.1.1");
		const h2 = addrHash("192.168.1.1");
		expect(h1).toBe(h2);
		expect(h1).toHaveLength(40);
	});

	it("produces different hashes for different IPs", () => {
		expect(addrHash("192.168.1.1")).not.toBe(addrHash("10.0.0.1"));
	});
});

// ─── Date String ────────────────────────────────────────────────────────────

describe("getDatestrFromDt", () => {
	it("formats a date as YYYYMMDD integer", () => {
		expect(getDatestrFromDt(new Date(2024, 0, 15))).toBe(20240115);
		expect(getDatestrFromDt(new Date(2023, 11, 1))).toBe(20231201);
	});
});

// ─── Check String ───────────────────────────────────────────────────────────

describe("checkStr", () => {
	it("accepts clean strings", () => {
		expect(checkStr("hello world")).toBe(true);
	});

	it("rejects HTML-like content", () => {
		expect(checkStr("<script>alert('xss')</script>")).toBe(false);
	});
});

// ─── Tokenize ───────────────────────────────────────────────────────────────

describe("tokenize", () => {
	it("splits on word boundaries and lowercases", () => {
		expect(tokenize("Hello World")).toEqual(["hello", "world"]);
	});

	it("handles punctuation", () => {
		expect(tokenize("it's a test!")).toEqual(["it's", "a", "test"]);
	});

	it("returns empty array for empty string", () => {
		expect(tokenize("")).toEqual([]);
	});
});

// ─── Wilson Score ───────────────────────────────────────────────────────────

describe("wilson", () => {
	it("returns 0 for zero total", () => {
		expect(wilson(0, 0)).toBe(0);
	});

	it("returns higher score for more upvotes", () => {
		const scoreA = wilson(100, 10);
		const scoreB = wilson(50, 10);
		expect(scoreA).toBeGreaterThan(scoreB);
	});

	it("returns a non-negative integer", () => {
		const score = wilson(50, 5);
		expect(score).toBeGreaterThanOrEqual(0);
		expect(Number.isInteger(score)).toBe(true);
	});
});

// ─── Review Score ───────────────────────────────────────────────────────────

describe("getReviewScore", () => {
	const ctx = { version: "1.0", distro: "Fedora" };

	it("newer reviews score higher", () => {
		const now = new Date();
		const old = new Date(now.getTime() - 365 * 86_400_000);

		const scoreNew = getReviewScore(
			{ karmaUp: 5, karmaDown: 1, dateCreated: now, version: "1.0", distro: "Fedora" },
			ctx,
		);
		const scoreOld = getReviewScore(
			{ karmaUp: 5, karmaDown: 1, dateCreated: old, version: "1.0", distro: "Fedora" },
			ctx,
		);
		expect(scoreNew).toBeGreaterThanOrEqual(scoreOld);
	});

	it("matching version avoids penalty", () => {
		const now = new Date();
		const matched = getReviewScore(
			{ karmaUp: 5, karmaDown: 1, dateCreated: now, version: "1.0", distro: "Fedora" },
			ctx,
		);
		const unmatched = getReviewScore(
			{ karmaUp: 5, karmaDown: 1, dateCreated: now, version: "2.0", distro: "Fedora" },
			ctx,
		);
		expect(matched).toBeGreaterThanOrEqual(unmatched);
	});
});
