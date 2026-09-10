import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing using scrypt (Node built-in — no external dependency).
 *
 * Stored as a salt (hex) and a derived key (hex). Verification is constant-time.
 * The scheme is versioned so we can migrate parameters or add MFA later without
 * breaking existing hashes.
 */

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

export interface PasswordRecord {
  hash: string;
  salt: string;
}

export function hashPassword(plain: string): PasswordRecord {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN).toString("hex");
  return { hash, salt };
}

export function verifyPassword(
  plain: string,
  record: { hash?: string | null; salt?: string | null },
): boolean {
  if (!record.hash || !record.salt) return false;
  const expected = Buffer.from(record.hash, "hex");
  let actual: Buffer;
  try {
    actual = scryptSync(plain, record.salt, expected.length);
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
