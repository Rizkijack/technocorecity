// Vitest setup: configure React 18+ to allow act() in tests.
// (vitest.config.ts pins environment=node globally; hooks tests override via
// environmentMatchGlobs -> jsdom for src/hooks/** and throttle files.)

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

export {}
