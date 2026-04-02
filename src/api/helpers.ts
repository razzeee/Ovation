import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import type { Context } from "hono";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { components, eventlog, reviews, taboos, users, votes } from "../db/schema.js";
import type { ReviewApiResponse } from "../lib/types.js";
import { addrHash, getUserKey, tokenize } from "../lib/util.js";

// ─── Client IP ───────────────────────────────────────────────────────────────

/** Extract the real client IP from request headers or connection info. */
export function getClientAddress(c: Context): string {
	const forwarded = c.req.header("X-Forwarded-For");
	if (forwarded) return forwarded.split(",")[0].trim();
	// Bun exposes the remote address on the server object; fallback to empty string
	return c.req.header("X-Real-IP") ?? "127.0.0.1";
}

// ─── Event Log ───────────────────────────────────────────────────────────────

export async function eventlogAdd(
	userAddr: string,
	userId: number | null,
	appId: string | null,
	message: string,
	important = false,
): Promise<void> {
	await db.insert(eventlog).values({
		userAddr: userAddr,
		userId,
		appId,
		message,
		important,
	});
}

// ─── Vote existence check ────────────────────────────────────────────────────

export async function voteExists(reviewId: number, userId: number): Promise<boolean> {
	const row = await db
		.select({ voteId: votes.voteId })
		.from(votes)
		.where(and(eq(votes.reviewId, reviewId), eq(votes.userId, userId)))
		.limit(1);
	return row.length > 0;
}

// ─── Review → JSON (asdict equivalent) ──────────────────────────────────────

interface ReviewRow {
	reviewId: number;
	dateCreated: Date;
	locale: string | null;
	summary: string | null;
	description: string | null;
	userDisplay: string | null;
	version: string | null;
	distro: string | null;
	rating: number | null;
	karmaUp: number | null;
	karmaDown: number | null;
	reported: number | null;
	componentAppId: string | null;
	userHash: string | null;
}

/** Convert a review row to the JSON shape expected by GNOME Software clients. */
export function reviewAsDict(row: ReviewRow, callerUserHash?: string): ReviewApiResponse {
	const item: ReviewApiResponse = {
		app_id: row.componentAppId ?? "",
		date_created: Math.floor(row.dateCreated.getTime() / 1000),
		description: row.description,
		distro: row.distro,
		karma_down: row.karmaDown ?? 0,
		karma_up: row.karmaUp ?? 0,
		locale: row.locale,
		rating: row.rating ?? 0,
		reported: row.reported ?? 0,
		review_id: row.reviewId,
		summary: row.summary,
		user_display: row.userDisplay,
		version: row.version,
	};

	if (row.userHash) {
		item.user_hash = row.userHash;
	}
	if (callerUserHash) {
		item.user_skey = getUserKey(callerUserHash, item.app_id);
	}
	return item;
}

// ─── Query reviews for app IDs ──────────────────────────────────────────────

/** Date cutoff for review freshness. */
function reviewCutoffDate(): Date {
	const cutoffDays = config.cutoffYears * 365;
	return new Date(Date.now() - cutoffDays * 86_400_000);
}

/**
 * Query valid (non-reported, non-expired) reviews for a set of app IDs.
 * Returns rows with joined component and user data.
 */
export async function queryReviewsForApp(appIds: string[]) {
	if (appIds.length === 0) return [];

	const cutoff = reviewCutoffDate();

	return db
		.select({
			reviewId: reviews.reviewId,
			dateCreated: reviews.dateCreated,
			locale: reviews.locale,
			summary: reviews.summary,
			description: reviews.description,
			userDisplay: reviews.userDisplay,
			version: reviews.version,
			distro: reviews.distro,
			rating: reviews.rating,
			karmaUp: reviews.karmaUp,
			karmaDown: reviews.karmaDown,
			reported: reviews.reported,
			componentId: reviews.componentId,
			userId: reviews.userId,
			componentAppId: components.appId,
			userHash: users.userHash,
		})
		.from(reviews)
		.innerJoin(components, eq(reviews.componentId, components.componentId))
		.leftJoin(users, eq(reviews.userId, users.userId))
		.where(
			and(
				inArray(components.appId, appIds),
				sql`${reviews.reported} < ${config.reportedThreshold}`,
				gt(reviews.dateCreated, cutoff),
			),
		)
		.orderBy(sql`${reviews.dateCreated} DESC`);
}

// ─── Component app_ids (self + parent + children) ───────────────────────────

/** Get all related app IDs for a component (self + parent + children). */
export async function getComponentAppIds(appId: string): Promise<Set<string>> {
	const component = await db.query.components.findFirst({
		where: eq(components.appId, appId),
		with: {
			parent: true,
			children: true,
		},
	});

	const ids = new Set<string>([appId]);
	if (!component) return ids;

	if (component.appId) ids.add(component.appId);
	if (component.parent?.appId) ids.add(component.parent.appId);
	if (component.children) {
		for (const child of component.children) {
			if (child.appId) ids.add(child.appId);
		}
	}
	return ids;
}

// ─── Taboo matching ─────────────────────────────────────────────────────────

/** Fetch taboo words for a given locale (locale + language code + "en"). */
export async function getTaboosForLocale(locale: string) {
	const lang = locale.split("_")[0];
	const locales = [locale, "en"];
	if (lang !== locale) locales.push(lang);

	return db.select({ value: taboos.value }).from(taboos).where(inArray(taboos.locale, locales));
}

/** Check if text contains any taboo words for the locale. Returns true if taboo found. */
export async function matchesTaboos(
	locale: string,
	summary: string,
	description: string,
	userDisplay?: string,
): Promise<boolean> {
	const tabooRows = await getTaboosForLocale(locale);
	if (tabooRows.length === 0) return false;

	const tabooSet = new Set(tabooRows.map((t) => t.value));

	// Build token set from all user-provided text
	const tokens = new Set<string>();
	for (const t of tokenize(summary)) tokens.add(t);
	for (const t of tokenize(description)) tokens.add(t);
	if (userDisplay) {
		for (const t of tokenize(userDisplay)) tokens.add(t);
	}

	for (const token of tokens) {
		if (tabooSet.has(token)) return true;
	}
	return false;
}

// ─── Users who are ignored for display name ─────────────────────────────────

export const USER_DISPLAY_IGNORE = new Set([
	"root",
	"Administrator",
	"Live System User",
	"user",
	"Unknown",
]);
