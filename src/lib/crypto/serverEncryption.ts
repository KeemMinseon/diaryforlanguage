import crypto from "crypto";

/**
 * Server-only AES-256-GCM helpers for encrypting the private parts of a
 * diary entry at rest — see README's "암호화" section for the exact list
 * of what's encrypted vs left as plaintext, and why.
 *
 * The key lives only in a server environment variable
 * (`DIARY_ENCRYPTION_KEY`) and this module uses Node's built-in `crypto`,
 * so it must never be imported from a "use client" component or a
 * Client Component — only from a Route Handler or a Server Component
 * (see `@/lib/crypto/entryFields` and the two callers of it).
 *
 * This is deliberately *not* the learner's own password/key — the design
 * here is "don't leave the diary readable in a raw Supabase row or
 * backup dump", not "keep it secret from this app's own server". See the
 * README for that tradeoff.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — the size GCM is designed for.
const VERSION_PREFIX = "v1";

function loadKey(): Buffer {
  const raw = process.env.DIARY_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "DIARY_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and set it as a server environment variable (see .env.local.example)."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "DIARY_ENCRYPTION_KEY must decode (as base64) to exactly 32 bytes — generate one with `openssl rand -base64 32`."
    );
  }
  return key;
}

/** True once a string has already gone through `encryptString` — a diary
 * entry saved before this feature existed (or one nobody has re-saved
 * since) has no such prefix, so `decryptString` can tell the two apart
 * and pass old plaintext straight through instead of failing to parse it
 * as ciphertext. Nothing migrates existing rows retroactively — every
 * *save* from here on encrypts, by design (see README). */
function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION_PREFIX}:`);
}

/** A fresh random IV per call (required for GCM — reusing one with the
 * same key breaks its confidentiality guarantee), with the auth tag
 * traveling alongside the ciphertext so a tampered value (or the wrong
 * key) fails loudly on decrypt instead of silently returning garbage. */
export function encryptString(plaintext: string): string {
  const key = loadKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION_PREFIX,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Passes a legacy plaintext value straight through (see `isEncrypted`)
 * — only actually decrypts a value this same module produced. */
export function decryptString(value: string): string {
  if (!isEncrypted(value)) return value;
  const key = loadKey();
  const parts = value.split(":");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted field: expected 4 ':'-separated parts.");
  }
  const [, ivB64, authTagB64, ciphertextB64] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function encryptNullable(value: string | null): string | null {
  return value === null ? null : encryptString(value);
}

export function decryptNullable(value: string | null): string | null {
  return value === null ? null : decryptString(value);
}
