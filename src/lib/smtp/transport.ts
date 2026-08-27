// ============================================================
// SMTP TRANSPORT HELPER
// Builds a nodemailer transport from saved SMTP settings.
// Handles password decryption + encryption mode mapping.
// ============================================================

import nodemailer from 'nodemailer';
import { decrypt } from '@/lib/encryption';

// -------------------- Types --------------------

export type SmtpEncryption = 'none' | 'SSL' | 'STARTTLS';

export interface SmtpConfigInput {
  provider?: string;
  host: string;
  port: number;
  encryption: SmtpEncryption;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  timeout: number;
  isActive?: boolean;
}

// -------------------- Helpers --------------------

/**
 * Heuristic: if the password looks like an AES-256-GCM ciphertext
 * (base64 + 100+ chars from our encrypt() output), try to decrypt it.
 * Otherwise return the plaintext as-is.
 */
async function resolvePassword(raw: string): Promise<string> {
  if (!raw) return '';

  // Masked placeholder from the UI — never attempt to decrypt.
  if (raw.includes('•')) {
    throw new Error(
      'Password is masked. Please re-enter the actual password before testing or saving.',
    );
  }

  // Encrypted ciphertext is base64 — IV(12) + ciphertext + tag(16) → typically 100+ chars
  // for any reasonably long password. Plain passwords are usually < 100 chars.
  const looksEncrypted = /^[A-Za-z0-9+/=]+$/.test(raw) && raw.length >= 100;
  if (looksEncrypted) {
    try {
      return await decrypt(raw);
    } catch {
      // Not actually encrypted, or decryption failed — fall through and use as-is.
      return raw;
    }
  }

  return raw;
}

/**
 * Map our encryption enum to nodemailer's secure/requireTLS/ignoreTLS flags.
 *  - SSL      → implicit TLS on connect (secure: true, port 465)
 *  - STARTTLS → opportunistic TLS upgrade (requireTLS: true, port 587)
 *  - none     → plaintext, no TLS upgrade (ignoreTLS: true, port 25)
 */
function buildTlsConfig(encryption: SmtpEncryption) {
  switch (encryption) {
    case 'SSL':
      return { secure: true, requireTLS: false, ignoreTLS: false };
    case 'STARTTLS':
      return { secure: false, requireTLS: true, ignoreTLS: false };
    case 'none':
    default:
      return { secure: false, requireTLS: false, ignoreTLS: true };
  }
}

// -------------------- Public API --------------------

/**
 * Create a configured nodemailer transport from SMTP settings.
 * Decrypts the password if it appears encrypted; throws on masked placeholder.
 */
export async function createSmtpTransport(cfg: SmtpConfigInput) {
  const password = await resolvePassword(cfg.password);

  const timeoutMs = Math.max(1, Number(cfg.timeout) || 10) * 1000;
  const tls = buildTlsConfig(cfg.encryption);

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: Number(cfg.port) || 587,
    secure: tls.secure,
    requireTLS: tls.requireTLS,
    ignoreTLS: tls.ignoreTLS,
    auth:
      cfg.username || password
        ? { user: cfg.username, pass: password }
        : undefined,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });

  return transport;
}

/**
 * Resolve the From address in `"Name <email>"` format for use with sendMail().
 */
export function resolveFromAddress(cfg: Pick<SmtpConfigInput, 'fromName' | 'fromEmail'>): string {
  const name = (cfg.fromName || '').trim();
  const email = (cfg.fromEmail || '').trim();
  if (!email) return '';
  if (!name) return email;
  return `${name} <${email}>`;
}
