/**
 * Wilson score confidence interval for sorting by average rating.
 * Algorithm from http://www.evanmiller.org/how-not-to-sort-by-average-rating.html
 */
export function wilson(ku: number, kd: number): number {
	if (ku <= 0 && kd <= 0) return 0;

	const n = ku + kd;
	const score =
		((ku + 1.9208) / n - (1.96 * Math.sqrt((ku * kd) / n + 0.9604)) / n) / (1 + 3.8416 / n);

	return Math.floor(score * 100);
}
