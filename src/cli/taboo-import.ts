/**
 * CLI: Import taboo words from a CSV file.
 *
 * Usage: bun run src/cli/taboo-import.ts <csv-file>
 *
 * CSV format: locale, values (slash-separated), description, severity
 * Example: en, slur1/slur2, offensive language, 5
 *
 * After importing, runs taboo-check on all existing reviews if changes were made.
 */
import { parse } from "csv-parse/sync";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { reviews, taboos } from "../db/schema.js";
import { tokenize } from "../lib/util.js";

const csvFile = process.argv[2];
if (!csvFile) {
	console.error("Usage: bun run src/cli/taboo-import.ts <csv-file>");
	process.exit(1);
}

// ─── Load existing taboos ───────────────────────────────────────────────────

const existingRows = await db.select().from(taboos);
const existingMap = new Map<string, (typeof existingRows)[0]>();
for (const row of existingRows) {
	existingMap.set(`${row.locale}:${row.value}`, row);
}

// ─── Parse CSV ──────────────────────────────────────────────────────────────

const csvContent = await Bun.file(csvFile).text();
const records = parse(csvContent, { relax_column_count: true }) as string[][];

let isDirty = false;

for (const record of records) {
	if (record.length < 4) continue;

	const locale = record[0].trim();
	const values = record[1].trim();
	const description = record[2].trim();
	const severity = Number.parseInt(record[3].trim(), 10);

	for (let value of values.split("/")) {
		value = value.trim();
		if (!value) continue;

		const key = `${locale}:${value}`;
		const existing = existingMap.get(key);

		if (existing) {
			// Update if changed
			const updates: Record<string, unknown> = {};
			if (existing.description !== description) {
				console.log(
					`Modifying ${key} description from "${existing.description}" to "${description}"`,
				);
				updates.description = description;
			}
			if (existing.severity !== severity) {
				console.log(`Modifying ${key} severity from "${existing.severity}" to "${severity}"`);
				updates.severity = severity;
			}
			if (Object.keys(updates).length > 0) {
				await db.update(taboos).set(updates).where(eq(taboos.tabooId, existing.tabooId));
				isDirty = true;
			}
			continue;
		}

		// Skip multi-word or mixed-case values
		if (value.includes(" ")) {
			console.log(`Ignoring ${locale} ${value} (contains spaces)`);
			continue;
		}
		if (value.toLowerCase() !== value) {
			console.log(`Ignoring ${locale} ${value} (mixed case)`);
			continue;
		}

		console.log(`Adding ${key}`);
		await db.insert(taboos).values({ locale, value, description, severity });
		isDirty = true;
	}
}

console.log(`[taboo-import] import complete, dirty=${isDirty}`);

// ─── Re-check reviews if taboos changed ─────────────────────────────────────

if (isDirty) {
	console.log("[taboo-import] taboos changed, running taboo-check on existing reviews...");

	// Inline a simplified taboo-check
	const allTaboos = await db.select().from(taboos);
	const tabooByLocale = new Map<string, Set<string>>();

	for (const t of allTaboos) {
		if (!tabooByLocale.has(t.locale)) tabooByLocale.set(t.locale, new Set());
		tabooByLocale.get(t.locale)!.add(t.value);
	}

	function getTabooSet(locale: string): Set<string> {
		const lang = locale.split("_")[0];
		const result = new Set<string>();
		for (const v of tabooByLocale.get(locale) ?? []) result.add(v);
		for (const v of tabooByLocale.get("en") ?? []) result.add(v);
		if (lang !== locale) {
			for (const v of tabooByLocale.get(lang) ?? []) result.add(v);
		}
		return result;
	}

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
			const tabooSet = getTabooSet(locale);
			if (tabooSet.size === 0) continue;

			const tokens = new Set<string>();
			if (review.summary) for (const t of tokenize(review.summary)) tokens.add(t);
			if (review.description) for (const t of tokenize(review.description)) tokens.add(t);
			if (review.userDisplay) for (const t of tokenize(review.userDisplay)) tokens.add(t);

			let hasMatch = false;
			for (const token of tokens) {
				if (tabooSet.has(token)) {
					console.log(`  review ${review.reviewId} [${locale}]: ${token}`);
					hasMatch = true;
				}
			}

			if (hasMatch) {
				await db.update(reviews).set({ reported: 5 }).where(eq(reviews.reviewId, review.reviewId));
				flagged++;
			}
		}

		offset += BATCH_SIZE;
	}

	console.log(`[taboo-import] flagged ${flagged} reviews after import`);
}

console.log("[taboo-import] done");
