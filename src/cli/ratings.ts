/**
 * CLI: Generate ratings JSON file.
 *
 * Usage: bun run src/cli/ratings.ts <output-file>
 *
 * Iterates all components, computes aggregated ratings (including
 * parent/child hierarchy) and writes a JSON map to the given file.
 */
import { getAllRatings } from "../lib/ratings.js";

const outFile = process.argv[2];
if (!outFile) {
	console.error("Usage: bun run src/cli/ratings.ts <output-file>");
	process.exit(1);
}

console.log("[ratings] computing ratings for all components...");
const ratings = await getAllRatings();

const count = Object.keys(ratings).length;
console.log(`[ratings] writing ${count} app ratings to ${outFile}`);

await Bun.write(outFile, JSON.stringify(ratings, null, 4));
console.log("[ratings] done");
