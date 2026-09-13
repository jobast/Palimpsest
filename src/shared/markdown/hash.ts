/**
 * SHA-256 hex digest of a UTF-8 string. Uses the Web Crypto API, available as
 * `crypto.subtle` in both the Electron renderer and Node 22, so this module
 * stays free of node:crypto and works on both sides.
 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
