/**
 * DEPRECATED — kept only so old imports fail loudly instead of silently
 * doing one-connection-per-query against an env that is no longer written
 * to disk. Use the `db` fixture from fixtures/pages.fixture.ts instead,
 * and utils/db.ts for shared connection helpers.
 *
 * @deprecated Use the `db` fixture (fixtures/pages.fixture.ts) instead.
 */
export async function query(): Promise<never> {
  throw new Error(
    'fixtures/db-helper.ts is deprecated. Use the `db` fixture from fixtures/pages.fixture.ts. ' +
    'The old db-runtime.json handoff was removed; DB coordinates now live in process.env, ' +
    'set by globalSetup (fixtures/db.fixture.ts).',
  );
}
