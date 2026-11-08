/**
 * Schema for the test database. Applied by the fixture layer (globalSetup
 * in fixtures/db.fixture.ts) on the fresh MySQL instance before tests run.
 *
 * Tables:
 *   users    - accounts for the demo shop (login, locked flag, full name)
 *   products - product catalog
 *   orders   - rows written by the demo app via POST /api/orders.
 *              This is the table the closed-loop test asserts against.
 *
 * Note: order IDs are NOT random — the app generates sequential auto-increment
 * IDs. Isolation between runs comes from unique shipping_phone values
 * generated per test (see utils/data-generator.ts) plus cleanupStrategy
 * described in README: the test asserts on its own unique phone key.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(64)  NOT NULL UNIQUE,
  password      VARCHAR(128) NOT NULL,
  full_name     VARCHAR(128) NOT NULL,
  locked        BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS products (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(128) NOT NULL,
  price DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  product_id       INT NOT NULL,
  shipping_name    VARCHAR(128) NOT NULL,
  shipping_phone   VARCHAR(32)  NOT NULL,
  shipping_address VARCHAR(255) NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'confirmed',
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user    FOREIGN KEY (user_id)    REFERENCES users(id),
  CONSTRAINT fk_orders_product FOREIGN KEY (product_id) REFERENCES products(id)
);
`;

export const SEED_SQL = `
INSERT INTO users (username, password, full_name, locked) VALUES
  ('standard_user', 'secret_sauce', 'Standard User', FALSE),
  ('locked_out_user', 'secret_sauce', 'Locked User', TRUE)
ON DUPLICATE KEY UPDATE username = VALUES(username);

INSERT INTO products (name, price) VALUES
  ('Sauce Labs Backpack',  29.99),
  ('Sauce Labs Bike Light', 9.99)
ON DUPLICATE KEY UPDATE name = VALUES(name);
`;
