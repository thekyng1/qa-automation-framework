/**
 * Unique keys per test run → two consecutive runs produce identical results
 * with zero interference, even for rows the application commits itself
 * (which the test transaction cannot roll back).
 */
export function randomPhone(): string {
  const digits = () => Math.floor(Math.random() * 10);
  return `+407${Array.from({ length: 8 }, digits).join('')}`;
}

export function randomEmail(prefix = 'qa'): string {
  return `${prefix}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}@test-mail.example`;
}
