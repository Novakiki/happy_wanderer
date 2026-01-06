export type FixtureCleanup = () => void | Promise<void>;

/**
 * Helper to reduce nested try/finally blocks in e2e tests.
 *
 * Usage:
 * - When you create something, immediately register how to clean it up via `use(value, cleanup)`.
 * - Cleanups run in reverse order (last created, first cleaned up).
 * - Cleanups run even if fixture setup fails, the test is skipped, or the test throws.
 */
export async function withFixtures<T>(
  setup: (use: <V>(value: V, cleanup: FixtureCleanup) => V) => Promise<T> | T,
  run: (fixtures: T) => Promise<void>
): Promise<void> {
  const cleanups: FixtureCleanup[] = [];

  const use = <V,>(value: V, cleanup: FixtureCleanup) => {
    cleanups.push(cleanup);
    return value;
  };

  let fixtures: T | null = null;

  try {
    fixtures = await setup(use);
    await run(fixtures);
  } finally {
    // Always attempt all cleanups. Log cleanup failures but don't mask the real test failure.
    for (let i = cleanups.length - 1; i >= 0; i -= 1) {
      try {
        await cleanups[i]();
      } catch (err) {
        console.warn('E2E fixture cleanup failed:', err);
      }
    }
  }
}

