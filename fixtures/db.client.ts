/**
 * Per-test database client with the cleanup strategy required by the spec:
 *   - each test gets ONE connection inside a transaction (BEGIN)
 *   - rollback in the fixture teardown — data seeded by the test itself never leaks
 *   - READ COMMITTED isolation: so assertions see rows committed by the
 *     demo app during the test (under MySQL's default REPEATABLE READ the
 *     snapshot would hide them — a classic false-negative trap)
 *   - rows written by the APP (its own connection, its own commit) cannot be
 *     rolled back from here. Tests isolate those by asserting on a unique
 *     key generated per run (utils/data-generator.ts) and registering
 *     cleanupLater(), executed right after rollback.
 */
import { expect as baseExpect } from '@playwright/test';
import type { Connection } from 'mysql2/promise';
import { query, findOne, count, type Where } from '../utils/db';

export class DbClient {
  private readonly cleanups: Array<{ table: string; where: Where }> = [];

  constructor(private readonly conn: Connection) {}

  query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    return query<T>(this.conn, sql, params);
  }

  findOne<T = any>(table: string, where: Where): Promise<T | undefined> {
    return findOne<T>(this.conn, table, where);
  }

  count(table: string, where: Where): Promise<number> {
    return count(this.conn, table, where);
  }

  /** Register a row written by the app for deletion after the test's rollback. */
  cleanupLater(table: string, where: Where): void {
    this.cleanups.push({ table, where });
  }

  /** Internal — called by the db fixture after rollback. Not for test code. */
  async flushCleanups(): Promise<void> {
    for (const { table, where } of this.cleanups) {
      const keys = Object.keys(where);
      await this.query(
        `DELETE FROM ?? WHERE ${keys.map(() => '?? = ?').join(' AND ')}`,
        [table, ...keys.flatMap((k) => [k, where[k]])],
      );
    }
  }
}

/** expect(db).toHaveRecord('orders', { shipping_phone: phone }) */
export const expect = baseExpect.extend({
  async toHaveRecord(received: DbClient, table: string, where: Where) {
    const record = await received.findOne(table, where);
    return {
      pass: record !== undefined,
      message: () => `Expected a record in \`${table}\` matching ${JSON.stringify(where)}, but none was found.`,
    };
  },
  async toHaveNoRecord(received: DbClient, table: string, where: Where) {
    const record = await received.findOne(table, where);
    return {
      pass: record === undefined,
      message: () => `Expected NO record in \`${table}\` matching ${JSON.stringify(where)}, but found: ${JSON.stringify(record)}.`,
    };
  },
  async toHaveRecordCount(received: DbClient, table: string, where: Where, expected: number) {
    const actual = await received.count(table, where);
    return {
      pass: actual === expected,
      message: () => `Expected ${expected} record(s) in \`${table}\` matching ${JSON.stringify(where)}, found ${actual}.`,
    };
  },
});

declare module '@playwright/test' {
  interface Matchers<R> {
    toHaveRecord(table: string, where: Record<string, unknown>): R;
    toHaveNoRecord(table: string, where: Record<string, unknown>): R;
    toHaveRecordCount(table: string, where: Record<string, unknown>, expected: number): R;
  }
}
