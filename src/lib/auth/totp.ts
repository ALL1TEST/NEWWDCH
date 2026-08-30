// ============================================================
// TOTP — Time-based One-Time Password helpers (RFC 6238).
// ============================================================
// Built on `otplib@13`'s functional API:
//   - generateSecret()  → base32 secret (sync)
//   - generateURI(...)  → otpauth:// URI (sync)
//   - generate({...})   → current TOTP code (async)
//   - verify({...})     → { valid, delta } (async)
//
// Used by /api/auth/2fa/* for setup, activation, disable, regenerate.
//
// Secrets are persisted to User.mfaSecret ENCRYPTED at rest via the
// existing AES-256-GCM `encrypt`/`decrypt` helpers in
// src/lib/encryption.ts — never in plain text. The plaintext secret is
// only ever returned to the authenticated user during the SETUP flow
// (so they can scan the QR / copy the manual key) and is never exposed
// again after activation.
// ============================================================

import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { encrypt, decrypt } from '@/lib/encryption';

const ISSUER = 'Platform CMS';

/** Generate a fresh base32 TOTP secret (random, ~160 bits). */
export function generateNewSecret(): string {
  // otplib's generateSecret() returns a base32-encoded secret compatible
  // with Google Authenticator / Authy / 1Password etc.
  return generateSecret();
}

/** Build the otpauth:// URI for QR code generation. */
export function generateOtpauthUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

/** Generate a QR code as a base64 data URL (PNG) for the given otpauth URI. */
export async function generateQrDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  });
}

/**
 * Verify a 6-digit TOTP code against a plaintext secret.
 * otplib@13's `verify` is async (uses an async crypto plugin) and returns
 * `{ valid, delta }`. We accept ±1 window drift (default window) for clock
 * skew between client and server.
 */
export async function verifyToken(secret: string, token: string): Promise<boolean> {
  if (!secret || !token) return false;
  const clean = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  try {
    const result = await verify({ secret, token: clean });
    return !!result?.valid;
  } catch {
    return false;
  }
}

/** Encrypt a plaintext secret for persistence. */
export async function encryptSecret(plaintext: string): Promise<string> {
  return encrypt(plaintext);
}

/** Decrypt a stored secret. Returns null if missing / invalid. */
export async function decryptSecret(ciphertext: string | null | undefined): Promise<string | null> {
  if (!ciphertext) return null;
  try {
    return await decrypt(ciphertext);
  } catch {
    return null;
  }
}

