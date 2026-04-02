import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { components, reviews } from "../db/schema.js";
import type { RatingResponse } from "./types.js";

/**
 * Build a base query for valid (non-reported, non-expired) reviews matching the given app IDs.
 */
function reviewCutoffDate(): Date {
	const cutoffDays = config.cutoffYears * 365;
	return new Date(Date.now() - cutoffDays * 86_400_000);
}

/**
 * Get all app_ids related to a component (self + parent + children).
 */
export async function getComponentAppIds(appId: string): Promise<string[]> {
	const component = await db.query.components.findFirst({
		where: eq(components.appId, appId),
		with: {
			parent: true,
			children: true,
		},
	});

	if (!component) return [appId];

	const ids = new Set<string>();
	if (component.appId) ids.add(component.appId);
	if (component.parent?.appId) ids.add(component.parent.appId);
	if (component.children) {
		for (const child of component.children) {
			if (child.appId) ids.add(child.appId);
		}
	}
	return Array.from(ids);
}

/**
 * Get ratings for a single component (identified by its related app IDs).
 */
export async function getRatingForComponent(
	appIds: string[],
	minTotal = 1,
): Promise<RatingResponse | null> {
	const cutoff = reviewCutoffDate();

	const rows = await db
		.select({
			bucket: sql<number>`CAST(${reviews.rating} / 20 AS INTEGER)`,
			count: sql<number>`COUNT(${reviews.reviewId})`,
		})
		.from(reviews)
		.innerJoin(components, eq(reviews.componentId, components.componentId))
		.where(
			and(
				inArray(components.appId, appIds),
				sql`${reviews.reported} < ${config.reportedThreshold}`,
				gt(reviews.dateCreated, cutoff),
			),
		)
		.groupBy(sql`CAST(${reviews.rating} / 20 AS INTEGER)`);

	const array = [0, 0, 0, 0, 0, 0];
	for (const row of rows) {
		const idx = Number(row.bucket);
		if (idx >= 0 && idx <= 5) {
			array[idx] = Number(row.count);
		}
	}

	const total = array.reduce((a, b) => a + b, 0);
	if (total < minTotal) return null;

	return {
		total,
		star0: array[0],
		star1: array[1],
		star2: array[2],
		star3: array[3],
		star4: array[4],
		star5: array[5],
	};
}

/**
 * Get ratings for ALL components in a single efficient query.
 * Mirrors the bulk aggregation in the original _api_ratings().
 */
export async function getAllRatings(): Promise<Record<string, RatingResponse>> {
	const cutoff = reviewCutoffDate();

	// 1. Bulk aggregation: group by app_id and rating bucket
	const statsQuery = await db
		.select({
			appId: components.appId,
			bucket: sql<number>`CAST(${reviews.rating} / 20 AS INTEGER)`,
			count: sql<number>`COUNT(${reviews.reviewId})`,
		})
		.from(reviews)
		.innerJoin(components, eq(reviews.componentId, components.componentId))
		.where(
			and(sql`${reviews.reported} < ${config.reportedThreshold}`, gt(reviews.dateCreated, cutoff)),
		)
		.groupBy(components.appId, sql`CAST(${reviews.rating} / 20 AS INTEGER)`);

	// 2. Build raw lookup
	const rawLookup: Record<string, number[]> = {};
	for (const row of statsQuery) {
		const appId = row.appId;
		if (!appId) continue;
		if (!rawLookup[appId]) rawLookup[appId] = [0, 0, 0, 0, 0, 0];

		const idx = Number(row.bucket);
		if (idx >= 0 && idx <= 5) {
			rawLookup[appId][idx] = Number(row.count);
		}
	}

	// 3. Fetch component hierarchy
	const componentRows = await db
		.select({
			componentId: components.componentId,
			appId: components.appId,
			parentId: components.componentIdParent,
		})
		.from(components);

	// 4. Build parent->children maps
	const childrenMap: Record<number, number[]> = {};
	const idToAppId: Record<number, string> = {};
	const idToParent: Record<number, number | null> = {};

	for (const row of componentRows) {
		if (row.appId) idToAppId[row.componentId] = row.appId;
		idToParent[row.componentId] = row.parentId;
		if (row.parentId !== null) {
			if (!childrenMap[row.parentId]) childrenMap[row.parentId] = [];
			childrenMap[row.parentId].push(row.componentId);
		}
	}

	// 5. Post-order traversal to compute subtree app_ids
	const remainingChildren: Record<number, number> = {};
	for (const cid in idToAppId) {
		remainingChildren[cid] = (childrenMap[Number(cid)] ?? []).length;
	}

	const queue: number[] = [];
	for (const cid in idToAppId) {
		if (remainingChildren[cid] === 0) queue.push(Number(cid));
	}

	const subtreeCache: Record<number, Set<string>> = {};
	const postOrder: number[] = [];

	while (queue.length > 0) {
		const compId = queue.shift()!;
		postOrder.push(compId);

		const result = new Set<string>();
		if (idToAppId[compId]) result.add(idToAppId[compId]);

		for (const childId of childrenMap[compId] ?? []) {
			for (const aid of subtreeCache[childId] ?? []) {
				result.add(aid);
			}
		}
		subtreeCache[compId] = result;

		const parentId = idToParent[compId];
		if (parentId !== null && parentId !== undefined && parentId in remainingChildren) {
			remainingChildren[parentId] -= 1;
			if (remainingChildren[parentId] === 0) {
				queue.push(parentId);
			}
		}
	}

	// Fallback for any missed nodes
	for (const cid in idToAppId) {
		if (!subtreeCache[Number(cid)]) {
			subtreeCache[Number(cid)] = new Set([idToAppId[Number(cid)]]);
		}
	}

	// 6. Aggregate ratings per component
	const ratings: Record<string, RatingResponse> = {};

	for (const row of componentRows) {
		if (!row.appId) continue;
		const idsToCheck = subtreeCache[row.componentId] ?? new Set();
		const appStats = [0, 0, 0, 0, 0, 0];
		let foundData = false;

		for (const aid of idsToCheck) {
			if (rawLookup[aid]) {
				foundData = true;
				for (let i = 0; i < 6; i++) {
					appStats[i] += rawLookup[aid][i];
				}
			}
		}

		const total = appStats.reduce((a, b) => a + b, 0);
		if (foundData && total >= 1) {
			ratings[row.appId] = {
				total,
				star0: appStats[0],
				star1: appStats[1],
				star2: appStats[2],
				star3: appStats[3],
				star4: appStats[4],
				star5: appStats[5],
			};
		}
	}

	return ratings;
}
