/**
 * CLI: Check all reviews against taboo word lists.
 *
 * Usage: bun run src/cli/taboo-check.ts
 *
 * Scans all reviews with reported < 5, checks them against taboo words
 * for their locale, and sets reported=5 for any that match.
 */
import { eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { reviews, taboos } from "../db/schema.js";
import { tokenize } from "../lib/util.js";

// Cache taboo sets by locale
const tabooCache = new Map<string, Set<string>>();

async function getTabooSet(locale: string): Promise<Set<string>> {
	if (tabooCache.has(locale)) return tabooCache.get(locale)!;

	const lang = locale.split("_")[0];
	const locales = [locale, "en"];
	if (lang !== locale) locales.push(lang);

	const rows = await db
		.select({ value: taboos.value })
		.from(taboos)
		.where(inArray(taboos.locale, locales));

	const set = new Set(rows.map((r) => r.value));
	tabooCache.set(locale, set);
	return set;
}

function matchesTaboos(
	tabooSet: Set<string>,
	summary: string | null,
	description: string | null,
	userDisplay: string | null,
): string[] {
	const matched: string[] = [];
	const tokens = new Set<string>();

	if (summary) for (const t of tokenize(summary)) tokens.add(t);
	if (description) for (const t of tokenize(description)) tokens.add(t);
	if (userDisplay) for (const t of tokenize(userDisplay)) tokens.add(t);

	for (const token of tokens) {
		if (tabooSet.has(token)) matched.push(token);
	}
	return matched;
}

console.log("[taboo-check] scanning reviews...");

// Process in batches
const BATCH_SIZE = 500;
let offset = 0;
let flagged = 0;

while (true) {
	const batch = await db
		.select({
			reviewId: reviews.reviewId,
			locale: reviews.locale,
			summary: reviews.summary,
			description: reviews.description,
			userDisplay: reviews.userDisplay,
		})
		.from(reviews)
		.where(lt(reviews.reported, 5))
		.limit(BATCH_SIZE)
		.offset(offset);

	if (batch.length === 0) break;

	for (const review of batch) {
		const locale = review.locale ?? "en";
		const tabooSet = await getTabooSet(locale);
		if (tabooSet.size === 0) continue;

		const matched = matchesTaboos(tabooSet, review.summary, review.description, review.userDisplay);
		if (matched.length > 0) {
			for (const word of matched) {
				console.log(`  review ${review.reviewId} [${locale}]: ${word}`);
			}
			await db.update(reviews).set({ reported: 5 }).where(eq(reviews.reviewId, review.reviewId));
			flagged++;
		}
	}

	offset += BATCH_SIZE;
}

console.log(`[taboo-check] flagged ${flagged} reviews, done`);
