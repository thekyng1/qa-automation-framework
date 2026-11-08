/**
 * Minimal demo application used as the system under test.
 *
 * Built with Node's built-in http module and the already-installed mysql2
 * package — deliberately zero new dependencies, so package-lock.json stays
 * valid and `npm ci` keeps working without regenerating it.
 *
 * Endpoints:
 *   GET  /health                 liveness probe (used by Playwright globalSetup)
 *   GET  /                       serves public/index.html (login + shop + checkout SPA)
 *   GET  /api/products           product catalog
 *   POST /api/auth/login         { username, password } -> { token, fullName } | 401 | 403
 *   POST /api/orders             Bearer token + { productId, fullName, phone, address } -> 201 { orderId }
 *   GET  /api/orders/:id         Bearer token -> order row
 *
 * Orders are INSERTed into MySQL by THIS process (its own connection and
 * commit). That is what makes the three-layer closed loop real: the UI test
 * clicks in the browser, this app commits to the database, and the test then
 * asserts the persisted row via a separate connection.
 */
const http = require('http');
const mysql = require('mysql2/promise');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.APP_PORT || 3100);

let pool;

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

/** Pseudo-token: base64("username:timestamp"). NOT secure — this is a test app. */
function makeToken(username) {
  return Buffer.from(`${username}:${Date.now()}`).toString('base64');
}

function usernameFromToken(header) {
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    return Buffer.from(header.slice(7), 'base64').toString('utf-8').split(':')[0] || null;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (req.method === 'GET' && pathname === '/api/products') {
      const [rows] = await pool.query('SELECT id, name, price FROM products ORDER BY id');
      return sendJson(res, 200, rows);
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const { username, password } = await readBody(req);
      const [[user]] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
      if (!user || user.password !== password) {
        return sendJson(res, 401, { error: 'Invalid credentials' });
      }
      if (user.locked) {
        return sendJson(res, 403, { error: 'Sorry, this user has been locked out.' });
      }
      return sendJson(res, 200, { token: makeToken(user.username), fullName: user.full_name });
    }

    if (req.method === 'POST' && pathname === '/api/orders') {
      const username = usernameFromToken(req.headers.authorization);
      if (!username) return sendJson(res, 401, { error: 'Authentication required' });

      const { productId, fullName, phone, address } = await readBody(req);
      if (!productId || !fullName || !phone || !address) {
        return sendJson(res, 400, { error: 'Missing required fields: productId, fullName, phone, address' });
      }

      const [[user]] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      const [[product]] = await pool.query('SELECT id, name FROM products WHERE id = ?', [productId]);
      if (!user) return sendJson(res, 401, { error: 'Unknown user' });
      if (!product) return sendJson(res, 404, { error: 'Unknown product' });

      const [result] = await pool.query(
        'INSERT INTO orders (user_id, product_id, shipping_name, shipping_phone, shipping_address) VALUES (?, ?, ?, ?, ?)',
        [user.id, product.id, fullName, phone, address],
      );
      return sendJson(res, 201, { orderId: result.insertId, product: product.name, status: 'confirmed' });
    }

    const orderMatch = pathname.match(/^\/api\/orders\/(\d+)$/);
    if (req.method === 'GET' && orderMatch) {
      const username = usernameFromToken(req.headers.authorization);
      if (!username) return sendJson(res, 401, { error: 'Authentication required' });
      const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [Number(orderMatch[1])]);
      if (!order) return sendJson(res, 404, { error: 'Order not found' });
      return sendJson(res, 200, order);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('Unhandled error:', err);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });
  console.log(`test-app listening on http://127.0.0.1:${PORT}`);
});
