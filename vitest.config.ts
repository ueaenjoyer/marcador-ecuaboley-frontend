import { defineConfig } from 'vitest/config';

// Test config for the mobile (Expo) project.
// Only the pure logic in `lib/` (api.ts, auth-store.ts, session-events.ts, helpers)
// is tested here with `fetch` and `expo-secure-store` mocked in memory —
// no device runtime or native render. See design.md "Testing Strategy".
//
// Note on the `@/*` alias: mobile/tsconfig.json extends `expo/tsconfig.base`
// with only `strict: true` and defines NO `@/*` path alias (unlike the backend).
// The feature's modules use relative imports, so no alias resolution is needed.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
