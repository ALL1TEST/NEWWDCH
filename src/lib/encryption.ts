// ============================================================
// ENCRYPTION UTILITY — AES-256-GCM for API key encryption
// ============================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Uint8Array {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    // Derive a stable key from a default secret (dev mode)
    return new TextEncoder().encode('cms-ai-encryption-key-32b!');
  }
  // Hash to always get 32 bytes
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(secret))
    .then((buf) => new Uint8Array(buf))
    .then((key) => {
      // Cache the key
      (getEncryptionKey as unknown as { _cached: Uint8Array })._cached = key;
      return key;
    }) as unknown as Uint8Array;
}

let _cachedKey: Uint8Array | null = null;

async function getKey(): Promise<Uint8Array> {
  if (_cachedKey) return _cachedKey;
  const secret = process.env.ENCRYPTION_SECRET || 'cms-ai-encryption-key-32b!';
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  _cachedKey = new Uint8Array(hash);
  return _cachedKey;
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    await crypto.subtle.importKey('raw', key, { name: ALGORITHM }, false, ['encrypt']),
    new TextEncoder().encode(plaintext),
  );
  // Combine iv + encrypted (includes auth tag)
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return Buffer.from(combined).toString('base64');
}

export async function decrypt(ciphertext: string): Promise<string> {
  try {
    const key = await getKey();
    const combined = Uint8Array.from(Buffer.from(ciphertext, 'base64'));
    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
      await crypto.subtle.importKey('raw', key, { name: ALGORITHM }, false, ['decrypt']),
      data,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Decryption failed — invalid ciphertext or key');
  }
}

/** Mask a secret for display, e.g. "sk-...xxxx" */
export function maskSecret(value: string): string {
  if (!value || value.length < 8) return '••••••••';
  return value.slice(0, 6) + '••••' + value.slice(-4);
}
