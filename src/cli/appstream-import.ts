/**
 * CLI: Import component hierarchy from an AppStream XML file (gzipped).
 *
 * Usage: bun run src/cli/appstream-import.ts <appstream.xml.gz>
 *
 * Reads a gzipped AppStream XML catalog, and for each <component> that has
 * <provides><id>...</id></provides>, sets up parent/child relationships
 * between the providing and provided component IDs.
 */
import { gunzipSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { XMLParser } from "fast-xml-parser";
import { db } from "../db/index.js";
import { components } from "../db/schema.js";

const xmlFile = process.argv[2];
if (!xmlFile) {
	console.error("Usage: bun run src/cli/appstream-import.ts <appstream.xml.gz>");
	process.exit(1);
}

// ─── Load existing components ───────────────────────────────────────────────

const componentRows = await db.select().from(components);
const appIdMap = new Map<string, (typeof componentRows)[0]>();
for (const row of componentRows) {
	if (row.appId) appIdMap.set(row.appId, row);
}

console.log(`[appstream-import] loaded ${appIdMap.size} existing components`);

// ─── Parse gzipped XML ──────────────────────────────────────────────────────

const gzBuf = await Bun.file(xmlFile).arrayBuffer();
const xmlStr = gunzipSync(Buffer.from(gzBuf)).toString("utf-8");

const parser = new XMLParser({
	ignoreAttributes: true,
	isArray: (name) => name === "component" || name === "id",
});

const parsed = parser.parse(xmlStr);
const xmlComponents = parsed?.components?.component ?? [];

let adopted = 0;

for (const comp of xmlComponents) {
	// Get the component's own ID
	const idField = comp.id;
	const appId = Array.isArray(idField) ? idField[0] : idField;
	if (!appId || typeof appId !== "string") continue;

	// Must exist in our DB
	if (!appIdMap.has(appId)) continue;
	const parent = appIdMap.get(appId)!;

	// Gather provided IDs
	const provides = comp.provides;
	if (!provides) continue;

	const provideIds: string[] = [];
	const rawIds = provides.id;
	if (Array.isArray(rawIds)) {
		for (const id of rawIds) {
			if (typeof id === "string") provideIds.push(id);
		}
	} else if (typeof rawIds === "string") {
		provideIds.push(rawIds);
	}

	for (const childId of provideIds) {
		if (childId === appId) continue;
		if (!appIdMap.has(childId)) continue;

		const child = appIdMap.get(childId)!;
		if (child.componentIdParent) continue; // Already has a parent

		console.log(`  adding AppStream parent for ${childId} -> ${appId}`);

		// Set child's parent
		await db
			.update(components)
			.set({ componentIdParent: parent.componentId })
			.where(eq(components.componentId, child.componentId));

		// Adopt grandchildren
		await db
			.update(components)
			.set({ componentIdParent: parent.componentId })
			.where(eq(components.componentIdParent, child.componentId));

		adopted++;
	}
}

console.log(`[appstream-import] adopted ${adopted} components, done`);
