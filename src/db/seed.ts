import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/password.js";
import { db } from "./index.js";
import { moderators, users } from "./schema.js";

const ADMIN_USER_HASH = "deadbeef348c0f88529f3bfd937ec1a5d90aefc7";

async function seed() {
	console.log("Seeding database...");

	// Ensure admin user exists
	const existingUser = await db
		.select()
		.from(users)
		.where(eq(users.userHash, ADMIN_USER_HASH))
		.limit(1);

	let userId: number;
	if (existingUser.length === 0) {
		const [inserted] = await db
			.insert(users)
			.values({ userHash: ADMIN_USER_HASH, karma: 0, isBanned: false })
			.returning({ userId: users.userId });
		userId = inserted.userId;
		console.log("Created admin user.");
	} else {
		userId = existingUser[0].userId;
	}

	// Ensure admin moderator exists
	const existingMod = await db
		.select()
		.from(moderators)
		.where(eq(moderators.username, "admin@test.com"))
		.limit(1);

	if (existingMod.length === 0) {
		const passwordHash = await hashPassword("Pa$$w0rd");
		await db.insert(moderators).values({
			username: "admin@test.com",
			passwordHash,
			displayName: "Admin",
			isEnabled: true,
			isAdmin: true,
			userId,
		});
		console.log("Created admin moderator (admin@test.com / Pa$$w0rd).");
	}

	console.log("Seeding complete.");
	process.exit(0);
}

seed().catch((err) => {
	console.error("Seeding failed:", err);
	process.exit(1);
});
