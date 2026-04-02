import { wilson } from "./wilson.js";

interface ReviewScoreInput {
	karmaUp: number;
	karmaDown: number;
	dateCreated: Date;
	version: string | null;
	distro: string | null;
}

interface FetchContext {
	version: string;
	distro: string;
}

/**
 * Compute a review's display score given the review data and the fetch context.
 * Higher scores appear first in results.
 */
export function getReviewScore(review: ReviewScoreInput, ctx: FetchContext): number {
	let ku = review.karmaUp;
	const kd = review.karmaDown;

	const msPerDay = 86_400_000;
	const monthsOld = Math.floor((Date.now() - review.dateCreated.getTime()) / msPerDay / 30);

	// Temporary visibility boost for very new reviews
	ku = Math.max(ku, 4 - monthsOld);

	// Penalty for age + mismatched version/distro
	let penalties = Math.floor(monthsOld / 12);
	if (review.version !== ctx.version) penalties += 1;
	if (review.distro !== ctx.distro) penalties += 1;

	const w = wilson(ku, kd);
	return Math.max(0, w - penalties * 10);
}
