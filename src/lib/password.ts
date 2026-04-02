import bcrypt from "bcryptjs";
import { legacyPasswordHash } from "./util.js";

const SALT_ROUNDS = 12;

/**
 * Hash a password with bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt and the legacy SHA1 hash (auto-upgrades on match).
 *
 * Returns { valid, needsUpgrade, newHash? }
 */
export async function verifyPassword(
	password: string,
	storedHash: string,
): Promise<{ valid: boolean; needsUpgrade: boolean; newHash?: string }> {
	// Legacy SHA1 hash (40 hex chars)
	if (storedHash.length === 40) {
		if (storedHash === legacyPasswordHash(password)) {
			const newHash = await hashPassword(password);
			return { valid: true, needsUpgrade: true, newHash };
		}
		return { valid: false, needsUpgrade: false };
	}

	// Standard bcrypt
	const valid = await bcrypt.compare(password, storedHash);
	return { valid, needsUpgrade: false };
}
