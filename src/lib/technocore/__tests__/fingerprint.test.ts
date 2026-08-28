import { describe, expect, it } from 'vitest'

import { fingerprint } from '../fingerprint'

const DID_KEY = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'

describe('fingerprint', () => {
  it('is deterministic: same input → same output', async () => {
    const a = await fingerprint(DID_KEY)
    const b = await fingerprint(DID_KEY)
    expect(a).toBe(b)
  })

  it('returns exactly 16 lowercase hex characters', async () => {
    const fp = await fingerprint(DID_KEY)
    expect(fp).toHaveLength(16)
    expect(fp).toMatch(/^[0-9a-f]{16}$/)
  })

  it('differs across distinct inputs', async () => {
    const a = await fingerprint('did:key:z6MkA')
    const b = await fingerprint('did:key:z6MkB')
    expect(a).not.toBe(b)
  })

  it('produces the known vector for the standard test DID key', async () => {
    // Pinned: first 16 hex chars of SHA-256("did:key:z6Mkh...2doK").
    // Any change to the digest input (e.g. stripping the "did:key:" prefix,
    // rejected by ADR-0004) or slice length breaks this test.
    expect(await fingerprint(DID_KEY)).toBe('8551f404ecfe6403')
  })

  it('hashes the FULL did:key string including the prefix (ADR-0004)', async () => {
    // If the prefix were stripped, the hash of the bare key would differ.
    const withPrefix = await fingerprint(DID_KEY)
    const withoutPrefix = await fingerprint(DID_KEY.replace('did:key:', ''))
    expect(withPrefix).not.toBe(withoutPrefix)
  })
})
