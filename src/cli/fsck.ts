/**
 * CLI: File-system check — auto-delete stale reviews and fix component hierarchy.
 *
 * Usage: bun run src/cli/fsck.ts
 *
 * 1. Auto-deletes reviews with reported=5 (taboo flagged) — limit 1000
 * 2. Auto-deletes reviews soft-deleted more than 31 days ago — limit 1000
 * 3. Fixes component parent/child hierarchy:
 *    - Snapcraft io.snapcraft.* → *.desktop
 *    - Dropped .desktop suffix → base ID
 *    - Shell extensions .shell-extension → base ID
 */
import { and, asc, eq, isNotNull, lt, ne, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { components, reviews, votes } from "../db/schema.js";

// ─── Auto-delete ────────────────────────────────────────────────────────────

async function autoDelete(days = 31): Promise<void> {
	// 1. Delete reviews flagged with reported=5 (taboo hits)
	const tabooReviews = await db
		.select({ reviewId: reviews.reviewId })
		.from(reviews)
		.where(eq(reviews.reported, 5))
		.orderBy(asc(reviews.dateCreated))
		.limit(1000);

	for (const r of tabooReviews) {
		await db.delete(votes).where(eq(votes.reviewId, r.reviewId));
		await db.delete(reviews).where(eq(reviews.reviewId, r.reviewId));
	}
	console.log(`[fsck] deleted ${tabooReviews.length} taboo-flagged reviews`);

	// 2. Delete soft-deleted reviews older than `days`
	const since = new Date(Date.now() - days * 86_400_000);
	const oldDeleted = await db
		.select({ reviewId: reviews.reviewId })
		.from(reviews)
		.where(and(isNotNull(reviews.dateDeleted), lt(reviews.dateDeleted, since)))
		.orderBy(asc(reviews.dateCreated))
		.limit(1000);

	for (const r of oldDeleted) {
		await db.delete(votes).where(eq(votes.reviewId, r.reviewId));
		await db.delete(reviews).where(eq(reviews.reviewId, r.reviewId));
	}
	console.log(`[fsck] deleted ${oldDeleted.length} old soft-deleted reviews`);
}

// ─── Component hierarchy fix ────────────────────────────────────────────────

async function adoptChild(
	parentId: number,
	childId: number,
	childAppId: string,
	parentAppId: string,
	reason: string,
): Promise<void> {
	console.log(`[fsck] adding ${reason} parent for ${childAppId} -> ${parentAppId}`);

	// Set child's parent
	await db
		.update(components)
		.set({ componentIdParent: parentId })
		.where(eq(components.componentId, childId));

	// Adopt grandchildren (any component whose parent was the child)
	await db
		.update(components)
		.set({ componentIdParent: parentId })
		.where(eq(components.componentIdParent, childId));
}

async function fsckComponents(): Promise<void> {
	// Load all components into a map
	const rows = await db
		.select()
		.from(components)
		.where(ne(components.appId, ""))
		.orderBy(asc(components.appId));

	const compMap = new Map<string, (typeof rows)[0]>();
	for (const row of rows) {
		if (row.appId) compMap.set(row.appId, row);
	}

	// 1. Snapcraft: io.snapcraft.<name>-<hash> → <name>.desktop
	for (const [appId, comp] of compMap) {
		if (!appId.startsWith("io.snapcraft.")) continue;
		if (comp.componentIdParent) continue;

		const suffix = appId.slice(13); // strip "io.snapcraft."
		const lastDash = suffix.lastIndexOf("-");
		if (lastDash === -1) continue;

		const name = suffix.slice(0, lastDash);
		const parent = compMap.get(`${name}.desktop`);
		if (!parent) continue;

		await adoptChild(parent.componentId, comp.componentId, appId, parent.appId!, "snapcraft");
	}

	// 2. Dropped .desktop: foo.desktop → foo
	for (const [appId, comp] of compMap) {
		if (comp.componentIdParent) continue;
		const stripped = appId.replace(".desktop", "");
		if (stripped === appId) continue;

		const parent = compMap.get(stripped);
		if (!parent) continue;

		await adoptChild(parent.componentId, comp.componentId, appId, parent.appId!, "desktop-suffix");
	}

	// 3. Shell extensions: foo.shell-extension → foo (@ → _)
	for (const [appId, comp] of compMap) {
		if (!appId.endsWith(".shell-extension")) continue;
		if (comp.componentIdParent) continue;

		let newId = appId.replace(".shell-extension", "");
		newId = newId.replace(/@/g, "_");

		const parent = compMap.get(newId);
		if (!parent) continue;

		await adoptChild(parent.componentId, comp.componentId, appId, parent.appId!, "shell-extension");
	}
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log("[fsck] starting...");
await autoDelete();
await fsckComponents();
console.log("[fsck] done");
