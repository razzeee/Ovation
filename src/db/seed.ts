import { eq, inArray } from "drizzle-orm";
import { hashPassword } from "../lib/password.js";
import { db } from "./index.js";
import {
	analytics,
	components,
	eventlog,
	moderators,
	reviews,
	taboos,
	users,
	votes,
} from "./schema.js";

const ADMIN_USER_HASH = "deadbeef348c0f88529f3bfd937ec1a5d90aefc7";

const SEED_USER_HASHES = [
	ADMIN_USER_HASH,
	"aabbcc1122334455667788990011223344556677",
	"bbccdd2233445566778899001122334455667788",
	"ccddee3344556677889900112233445566778899",
	"ddeeff4455667788990011223344556677889900",
];

const APP_IDS = [
	"org.gnome.Gedit",
	"org.gnome.Maps",
	"org.gnome.Clocks",
	"org.gnome.Calculator",
	"org.inkscape.Inkscape",
];

async function seed() {
	console.log("Seeding database...");

	// ── Users ────────────────────────────────────────────────────────────────

	const existingUsers = await db
		.select()
		.from(users)
		.where(inArray(users.userHash, SEED_USER_HASHES));

	const existingHashes = new Set(existingUsers.map((u) => u.userHash));

	const usersToInsert = [
		{ userHash: ADMIN_USER_HASH, karma: 100, isBanned: false },
		{ userHash: SEED_USER_HASHES[1], karma: 42, isBanned: false },
		{ userHash: SEED_USER_HASHES[2], karma: 7, isBanned: false },
		{ userHash: SEED_USER_HASHES[3], karma: 0, isBanned: true },
		{ userHash: SEED_USER_HASHES[4], karma: 15, isBanned: false },
	].filter((u) => !existingHashes.has(u.userHash));

	let insertedUsers: { userId: number; userHash: string | null }[] = [];
	if (usersToInsert.length > 0) {
		insertedUsers = await db.insert(users).values(usersToInsert).returning({
			userId: users.userId,
			userHash: users.userHash,
		});
		console.log(`Created ${insertedUsers.length} user(s).`);
	}

	const allUsers = [
		...existingUsers,
		...insertedUsers.map((u) => ({ userId: u.userId, userHash: u.userHash })),
	];

	const userIdByHash = new Map(allUsers.map((u) => [u.userHash, u.userId]));
	const adminUserId = userIdByHash.get(ADMIN_USER_HASH)!;

	// ── Moderators ───────────────────────────────────────────────────────────

	const modSeeds = [
		{
			username: "admin@test.com",
			displayName: "Admin",
			isAdmin: true,
			isEnabled: true,
			locales: null,
			userId: adminUserId,
		},
		{
			username: "mod.de@test.com",
			displayName: "German Moderator",
			isAdmin: false,
			isEnabled: true,
			locales: "de",
			userId: userIdByHash.get(SEED_USER_HASHES[1])!,
		},
		{
			username: "mod.fr@test.com",
			displayName: "French Moderator",
			isAdmin: false,
			isEnabled: true,
			locales: "fr",
			userId: userIdByHash.get(SEED_USER_HASHES[2])!,
		},
	];

	const existingMods = await db
		.select()
		.from(moderators)
		.where(
			inArray(
				moderators.username,
				modSeeds.map((m) => m.username),
			),
		);
	const existingModNames = new Set(existingMods.map((m) => m.username));

	for (const mod of modSeeds) {
		if (existingModNames.has(mod.username)) continue;
		const passwordHash = await hashPassword("Pa$$w0rd");
		await db.insert(moderators).values({ ...mod, passwordHash });
		console.log(`Created moderator: ${mod.username}`);
	}

	// ── Components ───────────────────────────────────────────────────────────

	const existingComponents = await db
		.select()
		.from(components)
		.where(inArray(components.appId, APP_IDS));

	const existingAppIds = new Set(existingComponents.map((c) => c.appId));

	const componentsToInsert = [
		{ appId: "org.gnome.Gedit", fetchCnt: 320, reviewCnt: 5 },
		{ appId: "org.gnome.Maps", fetchCnt: 210, reviewCnt: 3 },
		{ appId: "org.gnome.Clocks", fetchCnt: 180, reviewCnt: 4 },
		{ appId: "org.gnome.Calculator", fetchCnt: 450, reviewCnt: 6 },
		{ appId: "org.inkscape.Inkscape", fetchCnt: 590, reviewCnt: 8 },
	].filter((c) => !existingAppIds.has(c.appId));

	let insertedComponents: { componentId: number; appId: string | null }[] = [];
	if (componentsToInsert.length > 0) {
		insertedComponents = await db
			.insert(components)
			.values(componentsToInsert)
			.returning({ componentId: components.componentId, appId: components.appId });
		console.log(`Created ${insertedComponents.length} component(s).`);
	}

	const allComponents = [
		...existingComponents,
		...insertedComponents.map((c) => ({ componentId: c.componentId, appId: c.appId })),
	];

	const componentIdByAppId = new Map(allComponents.map((c) => [c.appId, c.componentId]));

	// ── Reviews ──────────────────────────────────────────────────────────────

	const existingReviews = await db.select({ reviewId: reviews.reviewId }).from(reviews).limit(1);

	if (existingReviews.length === 0) {
		const reviewSeeds = [
			{
				componentId: componentIdByAppId.get("org.gnome.Gedit")!,
				locale: "en",
				summary: "Great text editor",
				description: "Clean interface, fast and reliable. My go-to editor for quick edits.",
				userId: userIdByHash.get(SEED_USER_HASHES[1])!,
				userDisplay: "alice",
				version: "46.2",
				distro: "fedora",
				rating: 80,
				karmaUp: 10,
				karmaDown: 1,
			},
			{
				componentId: componentIdByAppId.get("org.gnome.Gedit")!,
				locale: "de",
				summary: "Solider Editor",
				description: "Einfach zu bedienen, gut für einfache Textdateien.",
				userId: userIdByHash.get(SEED_USER_HASHES[2])!,
				userDisplay: "bernd",
				version: "46.1",
				distro: "ubuntu",
				rating: 60,
				karmaUp: 4,
				karmaDown: 0,
			},
			{
				componentId: componentIdByAppId.get("org.gnome.Gedit")!,
				locale: "fr",
				summary: "Pas mal",
				description: "Simple et efficace, mais manque de fonctionnalités avancées.",
				userId: userIdByHash.get(SEED_USER_HASHES[4])!,
				userDisplay: "claude",
				version: "46.0",
				distro: "debian",
				rating: 60,
				karmaUp: 2,
				karmaDown: 1,
			},
			{
				componentId: componentIdByAppId.get("org.gnome.Maps")!,
				locale: "en",
				summary: "Good for navigation",
				description: "Works well offline. Tiles could load faster but overall solid.",
				userId: userIdByHash.get(SEED_USER_HASHES[1])!,
				userDisplay: "alice",
				version: "45.0",
				distro: "fedora",
				rating: 60,
				karmaUp: 6,
				karmaDown: 2,
			},
			{
				componentId: componentIdByAppId.get("org.gnome.Maps")!,
				locale: "de",
				summary: "Karten-App mit Potenzial",
				description: "OSM-Integration ist gut, aber die Performance lässt zu wünschen übrig.",
				userId: userIdByHash.get(SEED_USER_HASHES[2])!,
				userDisplay: "bernd",
				version: "45.0",
				distro: "opensuse",
				rating: 40,
				karmaUp: 3,
				karmaDown: 1,
			},
			{
				componentId: componentIdByAppId.get("org.gnome.Clocks")!,
				locale: "en",
				summary: "Simple and elegant",
				description: "Does exactly what I need. World clock, alarms and timers all in one.",
				userId: userIdByHash.get(SEED_USER_HASHES[4])!,
				userDisplay: "eve",
				version: "44.0",
				distro: "arch",
				rating: 100,
				karmaUp: 15,
				karmaDown: 0,
			},
			{
				componentId: componentIdByAppId.get("org.gnome.Clocks")!,
				locale: "en",
				summary: "Gets the job done",
				description: "Nothing fancy but it works. Would like more alarm options.",
				userId: userIdByHash.get(SEED_USER_HASHES[1])!,
				userDisplay: "alice",
				version: "44.0",
				distro: "ubuntu",
				rating: 60,
				karmaUp: 5,
				karmaDown: 1,
			},
			{
				componentId: componentIdByAppId.get("org.gnome.Calculator")!,
				locale: "en",
				summary: "Perfect calculator",
				description: "Scientific mode is great. Fast and accurate.",
				userId: userIdByHash.get(SEED_USER_HASHES[2])!,
				userDisplay: "bernd",
				version: "45.0",
				distro: "fedora",
				rating: 100,
				karmaUp: 20,
				karmaDown: 0,
			},
			{
				componentId: componentIdByAppId.get("org.gnome.Calculator")!,
				locale: "fr",
				summary: "Très bien",
				description: "Rapide et précis. Le mode scientifique est très utile.",
				userId: userIdByHash.get(SEED_USER_HASHES[4])!,
				userDisplay: "claude",
				version: "45.0",
				distro: "ubuntu",
				rating: 80,
				karmaUp: 8,
				karmaDown: 0,
			},
			{
				componentId: componentIdByAppId.get("org.inkscape.Inkscape")!,
				locale: "en",
				summary: "Professional vector graphics",
				description: "Powerful SVG editor. Steep learning curve but worth it.",
				userId: userIdByHash.get(SEED_USER_HASHES[1])!,
				userDisplay: "alice",
				version: "1.3.2",
				distro: "ubuntu",
				rating: 80,
				karmaUp: 35,
				karmaDown: 3,
			},
			{
				componentId: componentIdByAppId.get("org.inkscape.Inkscape")!,
				locale: "de",
				summary: "Tolle Vektorgrafik-Software",
				description: "Sehr mächtig, aber komplex. Für Profis absolut empfehlenswert.",
				userId: userIdByHash.get(SEED_USER_HASHES[2])!,
				userDisplay: "bernd",
				version: "1.3.2",
				distro: "arch",
				rating: 80,
				karmaUp: 12,
				karmaDown: 1,
			},
			{
				componentId: componentIdByAppId.get("org.inkscape.Inkscape")!,
				locale: "en",
				summary: "Crashes occasionally",
				description:
					"Great feature set but I experience random crashes on large SVG files.",
				userId: userIdByHash.get(SEED_USER_HASHES[4])!,
				userDisplay: "eve",
				version: "1.3.1",
				distro: "fedora",
				rating: 40,
				karmaUp: 7,
				karmaDown: 5,
				reported: 1,
			},
		];

		const insertedReviews = await db
			.insert(reviews)
			.values(reviewSeeds)
			.returning({ reviewId: reviews.reviewId });
		console.log(`Created ${insertedReviews.length} review(s).`);

		// ── Votes ────────────────────────────────────────────────────────────

		const voteSeeds = insertedReviews.flatMap((r, i) => {
			const voters = [
				userIdByHash.get(SEED_USER_HASHES[1])!,
				userIdByHash.get(SEED_USER_HASHES[2])!,
				userIdByHash.get(SEED_USER_HASHES[4])!,
			];
			return voters
				.filter((_, vi) => (i + vi) % 3 !== 0)
				.map((userId) => ({
					reviewId: r.reviewId,
					userId,
					val: (i + userId) % 5 < 3 ? 1 : -1,
				}));
		});

		await db.insert(votes).values(voteSeeds);
		console.log(`Created ${voteSeeds.length} vote(s).`);
	} else {
		console.log("Reviews already exist, skipping reviews and votes.");
	}

	// ── Taboos ───────────────────────────────────────────────────────────────

	const existingTaboos = await db.select({ tabooId: taboos.tabooId }).from(taboos).limit(1);

	if (existingTaboos.length === 0) {
		await db.insert(taboos).values([
			{ locale: "en", value: "spam", description: "Generic spam content", severity: 2 },
			{
				locale: "en",
				value: "hate",
				description: "Hateful or discriminatory content",
				severity: 3,
			},
			{
				locale: "en",
				value: "adult",
				description: "Explicit adult content",
				severity: 3,
			},
			{
				locale: "de",
				value: "spam",
				description: "Spam-Inhalte",
				severity: 2,
			},
			{
				locale: "de",
				value: "hass",
				description: "Hassrede oder diskriminierende Inhalte",
				severity: 3,
			},
			{
				locale: "fr",
				value: "spam",
				description: "Contenu spam",
				severity: 2,
			},
			{
				locale: "fr",
				value: "haine",
				description: "Contenu haineux ou discriminatoire",
				severity: 3,
			},
		]);
		console.log("Created taboos.");
	}

	// ── Analytics ────────────────────────────────────────────────────────────

	const existingAnalytics = await db
		.select()
		.from(analytics)
		.limit(1);

	if (existingAnalytics.length === 0) {
		const today = new Date();
		const toDatestr = (d: Date) =>
			d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

		const analyticsSeeds = APP_IDS.flatMap((appId, appIdx) =>
			[-2, -1, 0].map((dayOffset) => {
				const d = new Date(today);
				d.setDate(today.getDate() + dayOffset);
				return {
					datestr: toDatestr(d),
					appId,
					fetchCnt: 50 + appIdx * 20 + Math.abs(dayOffset) * 10,
				};
			}),
		);

		await db.insert(analytics).values(analyticsSeeds);
		console.log(`Created ${analyticsSeeds.length} analytics entry(s).`);
	}

	// ── Event Log ────────────────────────────────────────────────────────────

	const existingEvents = await db
		.select({ eventlogId: eventlog.eventlogId })
		.from(eventlog)
		.limit(1);

	if (existingEvents.length === 0) {
		await db.insert(eventlog).values([
			{
				userAddr: "127.0.0.1",
				userId: adminUserId,
				message: "admin login",
				appId: null,
				important: true,
			},
			{
				userAddr: "10.0.0.2",
				userId: userIdByHash.get(SEED_USER_HASHES[1])!,
				message: "review submitted",
				appId: "org.gnome.Gedit",
				important: false,
			},
			{
				userAddr: "10.0.0.3",
				userId: userIdByHash.get(SEED_USER_HASHES[2])!,
				message: "review submitted",
				appId: "org.gnome.Maps",
				important: false,
			},
			{
				userAddr: "10.0.0.4",
				userId: userIdByHash.get(SEED_USER_HASHES[3])!,
				message: "user banned",
				appId: null,
				important: true,
			},
			{
				userAddr: "10.0.0.5",
				userId: userIdByHash.get(SEED_USER_HASHES[4])!,
				message: "review reported",
				appId: "org.inkscape.Inkscape",
				important: true,
			},
		]);
		console.log("Created event log entries.");
	}

	console.log("Seeding complete.");
	process.exit(0);
}

seed().catch((err) => {
	console.error("Seeding failed:", err);
	process.exit(1);
});
