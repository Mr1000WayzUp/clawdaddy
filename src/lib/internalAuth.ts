// Internal-call token: generated lazily inside a request context (Workers
// disallow crypto randomness at global scope). The token never leaves the
// isolate, so only in-process calls (e.g. the cron handler invoking app.fetch
// against itself) can present it.
let internalToken: string | null = null

export function getInternalToken(): string {
  if (!internalToken) internalToken = crypto.randomUUID()
  return internalToken
}

export function isInternalRequest(c: any): boolean {
  const header = c.req.header('x-internal-token')
  if (internalToken && header === internalToken) return true
  // Allow explicit manual triggering when the owner has configured a secret
  const secret = c.env?.CRON_SECRET
  if (secret) {
    const provided = c.req.header('x-cron-key') || c.req.query('key')
    if (provided === secret) return true
  }
  return false
}
