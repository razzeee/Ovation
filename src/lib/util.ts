import { createHash } from "node:crypto";
import { config } from "../config.js";

/**
 * Generate a SHA1 HMAC-style hash of user_hash + app_id + secret.
 * This produces the `user_skey` that proves the user fetched reviews before voting.
 */
export function getUserKey(userHash: string, appId: string): string {
  try {
    return createHash("sha1")
      .update(config.reviewsSecret)
      .update(userHash)
      .update(appId)
      .digest("hex");
  } catch {
    return "invalid";
  }
}

/**
 * Generate a salted hash of an IP address for privacy.
 */
export function addrHash(addr: string): string {
  return createHash("sha1")
    .update(config.reviewsSecret + addr)
    .digest("hex");
}

/**
 * Legacy password hashing (SHA1 with static salt).
 * Only used for verifying old passwords before upgrading to bcrypt.
 */
export function legacyPasswordHash(value: string): string {
  const salt = "ovation%%%";
  return createHash("sha1").update(salt).update(value).digest("hex");
}

/**
 * Generate an integer datestring from a Date object: YYYYMMDD.
 */
export function getDatestrFromDt(when: Date): number {
  const y = when.getFullYear();
  const m = when.getMonth() + 1;
  const d = when.getDate();
  return Number.parseInt(
    `${y.toString().padStart(4, "0")}${m.toString().padStart(2, "0")}${d.toString().padStart(2, "0")}`,
    10,
  );
}

/**
 * Check if two locales are compatible for review display.
 */
export function localeIsCompatible(l1: string, l2: string): boolean {
  if (l1 === l2) return true;

  const lang1 = l1.split("_")[0];
  const lang2 = l2.split("_")[0];
  if (lang1 === lang2) return true;

  const enLangs = ["C", "en"];
  if (enLangs.includes(lang1) && enLangs.includes(lang2)) return true;

  return false;
}

/**
 * Strip and clean up user input.
 */
function sanitisedInput(val: string): string {
  let v = val.trim();
  v = v.replace(/!!!/g, "!");
  v = v.replace(/:\)/g, "");
  v = v.replace(/ {2}/g, " ");
  return v;
}

/**
 * Sanitise a review summary (also strips trailing period).
 */
export function sanitisedSummary(val: string): string {
  let v = sanitisedInput(val);
  if (v.endsWith(".")) {
    v = v.slice(0, -1);
  }
  return v;
}

/**
 * Sanitise a review description.
 */
export function sanitisedDescription(val: string): string {
  return sanitisedInput(val);
}

/**
 * Sanitise a version string: strip epoch (1:...), strip distro suffixes (+rh, ~ds0).
 */
export function sanitisedVersion(val: string): string {
  let v = val;

  // Remove epoch
  const epochIdx = v.indexOf(":");
  if (epochIdx !== -1) {
    v = v.slice(epochIdx + 1);
  }

  // Remove distro addition (+...)
  const plusIdx = v.indexOf("+");
  if (plusIdx !== -1) {
    v = v.slice(0, plusIdx);
  }
  const tildeIdx = v.indexOf("~");
  if (tildeIdx !== -1) {
    v = v.slice(0, tildeIdx);
  }

  return v;
}

/**
 * Check if a string contains HTML-like markup.
 */
export function checkStr(val: string): boolean {
  return !val.includes("<");
}

/**
 * Tokenize a string into lowercase word tokens.
 */
export function tokenize(val: string): string[] {
  const matches = val.match(/[\w']+/g);
  return matches ? matches.map((t) => t.toLowerCase()) : [];
}
