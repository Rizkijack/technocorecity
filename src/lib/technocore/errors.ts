/**
 * Data-layer error classes. Signatures per docs/06-api-integration.md ("Error Classes").
 */

/** Thrown by the adapter when a server response is structurally broken. */
export class ParseError extends Error {
  constructor(
    public context: string,
    message: string,
    public details?: unknown
  ) {
    super(`[parse:${context}] ${message}`)
    this.name = 'ParseError'
  }
}

/** Thrown by the network layer on a non-2xx response. */
export class NetworkError extends Error {
  constructor(
    public status: number,
    public statusText: string
  ) {
    super(`HTTP ${status}: ${statusText}`)
    this.name = 'NetworkError'
  }
}

/** Thrown on HTTP 429; carries the server-provided retry hint and bucket name. */
export class RateLimitError extends NetworkError {
  constructor(
    status: number,
    statusText: string,
    public retryAfter: number,
    public bucket: 'read' | 'write'
  ) {
    super(status, statusText)
    this.name = 'RateLimitError'
  }
}

/** Thrown when a long-poll request is cancelled via AbortController. */
export class AbortError extends Error {
  constructor() {
    super('Request aborted')
    this.name = 'AbortError'
  }
}

