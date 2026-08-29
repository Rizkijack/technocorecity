/**
 * Small validation helpers shared across parsers and consumers.
 */
import { ParseError } from './errors'

export function assertNonEmpty(context: string, text: string): void {
  if (!text || !text.trim()) {
    throw new ParseError(context, 'response was empty', { text })
  }
}
