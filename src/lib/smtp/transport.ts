// ============================================================
// SMTP TRANSPORT HELPER
// Builds a nodemailer transport from SMTP settings.
// Handles password decryption + encryption mode mapping + password normalization.
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
 * Normalizes and decrypts an SMTP password:
 * - If masked placeholder '••••••••', throws error (must be resolved before transport).
 * - If AES-256-GCM ciphertext (base64 string of IV(12)+tag(16)+data >= 40 chars), decrypts it.
 * - Trims leading/trailing whitespace.
 * - Removes all spaces for Google App Passwords / Gmail credentials.
 *   (e.g., "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
 */
export async function normalizeSmtpPassword(
  raw: string,
  host?: string,
  username?: string,
): Promise<string> {
  if (!raw) return '';

  if (raw.includes('•')) {
    throw new Error(
      'Password is masked. Please provide or resolve the actual password.',
    );
  }

  let pass = raw;

  // Try to decrypt if it looks like our AES-256-GCM base64 output
  if (/^[A-Za-z0-9+/=]+$/.test(pass) && pass.length >= 40) {
    try {
      const decrypted = await decrypt(pass);
      if (decrypted) {
        pass = decrypted;
      }
    } catch {
      // Not an encrypted ciphertext, keep as-is
    }
  }

  // 1. Trim leading and trailing whitespace
  pass = pass.trim();

  // 2. Remove all spaces for Google App Passwords or Gmail accounts
  const withoutSpaces = pass.replace(/\s+/g, '');
  const isGmail =
    Boolean(host && (host.toLowerCase().includes('gmail') || host.toLowerCase().includes('googlemail'))) ||
    Boolean(username && username.toLowerCase().includes('@gmail.com'));

  // Google App Passwords are 16 ascii characters, frequently formatted with spaces
  if (isGmail || withoutSpaces.length === 16) {
    pass = withoutSpaces;
  }

  return pass;
}

/**
 * Map encryption mode to nodemailer transport options:
 *  - STARTTLS → port 587, secure: false, requireTLS: true
 *  - SSL      → port 465, secure: true, requireTLS: false
 *  - none     → port 25, secure: false, ignoreTLS: true
 */
export function buildTlsConfig(encryption: SmtpEncryption) {
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
 * Normalizes credentials and applies TLS/timeout configurations.
 */
export async function createSmtpTransport(cfg: SmtpConfigInput) {
  const password = await normalizeSmtpPassword(cfg.password, cfg.host, cfg.username);

  const timeoutMs = Math.max(1, Number(cfg.timeout) || 10) * 1000;
  const tls = buildTlsConfig(cfg.encryption);

  const transport = nodemailer.createTransport({
    host: (cfg.host || '').trim(),
    port: Number(cfg.port) || 587,
    secure: tls.secure,
    requireTLS: tls.requireTLS,
    ignoreTLS: tls.ignoreTLS,
    auth:
      cfg.username || password
        ? { user: (cfg.username || '').trim(), pass: password }
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
