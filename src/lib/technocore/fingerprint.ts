/**
 * Stable short agent fingerprint: the first 16 lowercase hex chars of
 * SHA-256(did:key string). Per ADR-0004 the FULL did:key string — including
 * the "did:key:" prefix — is hashed, matching the server's own convention.
 */

/** Hash a did:key string; returns the first 8 bytes of SHA-256 as 16 lowercase hex chars. */
export async function fingerprint(didKey: string): Promise<string> {
  // Browser-native SubtleCrypto (also available in Node 19+ for tests).
  const data = new TextEncoder().encode(didKey)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  // First 8 bytes = 16 hex chars
  return Array.from(bytes.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

