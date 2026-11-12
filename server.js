const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== ADMIN AUTHENTICATION ====================
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'muhammadahmad4305@gmail.com').toLowerCase();
const ADMIN_PASSWORD_SALT = '825597687e8840df646c4ef7b54e8b99';
const ADMIN_PASSWORD_HASH = '027531bb8a7fa0fc0403b3c6c4d231c679f092c9b8ecdd9a97ccf781729dd0609cc8b1a672622278ad607ea0e92943119655c8e72bbaa69fb498f2eb1811f64f';
const SESSION_COOKIE_NAME = 'pomi_admin_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SECRET_FILE = path.join(__dirname, '.session-secret');

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated);
    return generated;
  } catch (err) {
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_SECRET = getSessionSecret();

function verifyAdminPassword(plainPassword) {
  if (typeof plainPassword !== 'string' || !plainPassword) return false;
  const derived = crypto.scryptSync(plainPassword, ADMIN_PASSWORD_SALT, 64);
  const expected = Buffer.from(ADMIN_PASSWORD_HASH, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function createSessionToken(email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed || parsed.email !== ADMIN_EMAIL || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const map = {};
  raw.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      map[k] = decodeURIComponent(v);
    }
  });
  return map;
}

function requireAdminAuth(req, res, next) {
  const cookies = parseCookies(req);
  const session = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Please login with admin account.' });
  }
  req.adminEmail = session.email;
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (normalizedEmail !== ADMIN_EMAIL || !verifyAdminPassword(String(password || ''))) {
    return res.status(401).json({ success: false, message: 'Ghalat Email ya Password! Sirf authorized admin hi login kar sakta hai.' });
  }

  const token = createSessionToken(ADMIN_EMAIL);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
  res.json({ success: true, email: ADMIN_EMAIL });
});

app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  res.json({ success: true });
});

app.get('/api/admin/me', (req, res) => {
  const cookies = parseCookies(req);
  const session = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true, email: session.email });
});

// In-memory or JSON file order storage
const ORDERS_FILE = path.join(__dirname, 'orders.json');
let orders = [];

try {
  if (fs.existsSync(ORDERS_FILE)) {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  }
} catch (e) {
  orders = [];
}

// Persistent Products Catalog (seeded from products-data.js on first run)
const DEFAULT_PRODUCTS = require('./public/js/products-data.js');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'images', 'uploads');
let products = [];

function saveProductsToFile() {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
  } catch (err) {
    console.error('Could not save products to file:', err.message);
  }
}

try {
  if (fs.existsSync(PRODUCTS_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    products = Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_PRODUCTS];
  } else {
    products = [...DEFAULT_PRODUCTS];
    saveProductsToFile();
  }
} catch (e) {
  products = [...DEFAULT_PRODUCTS];
}

// Coupon definitions
const COUPONS = {
  'LUXURY10': { type: 'percent', value: 10, minOrder: 3000, description: '10% Off Sitewide' },
  'FIRSTBUY': { type: 'percent', value: 15, minOrder: 5000, description: '15% Off Your First Order' },
  'FREESHIP': { type: 'shipping', value: 100, minOrder: 2000, description: 'Free Express Shipping' }
};

// API: Get products
app.get('/api/products', (req, res) => {
  const { category, search } = req.query;
  let result = [...products];

  if (category && category !== 'all') {
    result = result.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.tagline || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.notes && Object.values(p.notes).flat().some(n => n.toLowerCase().includes(q)))
    );
  }

  res.json({ success: true, count: result.length, data: result });
});

// API: Get single product
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, data: product });
});

// API: Upload perfume image (base64 dataUrl -> public/images/uploads/)
app.post('/api/upload-image', requireAdminAuth, (req, res) => {
  const { filename, dataUrl } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ success: false, message: 'Image data is required' });
  }

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
  if (!match) {
    return res.status(400).json({ success: false, message: 'Only PNG, JPG, WEBP, or GIF images are supported' });
  }

  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const baseSlug = String(filename || 'perfume')
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'perfume';
  const finalName = `${baseSlug}-${Date.now()}.${ext}`;

  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const buffer = Buffer.from(match[2], 'base64');
    fs.writeFileSync(path.join(UPLOADS_DIR, finalName), buffer);
    res.json({ success: true, imagePath: `images/uploads/${finalName}` });
  } catch (err) {
    console.error('Image upload error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to save image on server' });
  }
});

// Helper to normalize product payload from dashboard
function buildProductPayload(body, existing = null) {
  const price = Math.max(0, Number(body.price) || 0);
  const originalPrice = body.originalPrice ? Math.max(price, Number(body.originalPrice)) : null;
  const primarySize = String(body.primarySize || '50ml').trim() || '50ml';

  const sizes = [{ size: primarySize, price }];
  if (body.secondarySize && Number(body.secondaryPrice) > 0) {
    sizes.push({
      size: String(body.secondarySize).trim(),
      price: Number(body.secondaryPrice)
    });
  }

  const parseNotesList = (val, fallback) => {
    if (Array.isArray(val) && val.length > 0) return val;
    if (typeof val === 'string' && val.trim()) {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return fallback;
  };

  const categorySlug = String(body.category || 'unisex')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '') || 'unisex';

  return {
    id: existing ? existing.id : `pomi-${String(body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'perfume'}-${Date.now().toString().slice(-4)}`,
    name: String(body.name || '').trim(),
    tagline: String(body.tagline || 'Signature artisanal fragrance crafted for lasting distinction').trim(),
    category: categorySlug,
    badge: String(body.badge || 'New Launch').trim(),
    concentration: String(body.concentration || 'Extrait de Parfum').trim(),
    gender: String(body.gender || (categorySlug === 'men' ? 'Men' : categorySlug === 'women' ? 'Women' : 'Unisex')).trim(),
    rating: existing ? existing.rating : 5.0,
    reviewsCount: existing ? existing.reviewsCount : 1,
    price,
    originalPrice,
    image: String(body.image || 'images/pomi-collection.jpg').trim(),
    description: String(body.description || body.tagline || 'Crafted by Pomi Perfumes with rich French oils and remarkable longevity.').trim(),
    notes: {
      top: parseNotesList(body.topNotes, ['Bergamot', 'Saffron', 'Cardamom']),
      heart: parseNotesList(body.heartNotes, ['Damask Rose', 'Lavender', 'Amber']),
      base: parseNotesList(body.baseNotes, ['Royal Oud', 'Musk', 'Sandalwood'])
    },
    sizes,
    longevity: String(body.longevity || '14+ Hours').trim(),
    sillage: String(body.sillage || 'Commanding').trim(),
    inStock: body.inStock !== undefined ? Boolean(body.inStock) : true
  };
}

// API: Add a new perfume product
app.post('/api/products', requireAdminAuth, (req, res) => {
  const { name, price, category } = req.body || {};
  if (!name || !String(name).trim() || !category || !Number(price)) {
    return res.status(400).json({ success: false, message: 'Perfume name, category, and valid price are required' });
  }

  const newProduct = buildProductPayload(req.body);
  products.unshift(newProduct);
  saveProductsToFile();

  res.status(201).json({ success: true, message: 'Perfume added to store!', product: newProduct });
});

// API: Update existing perfume product
app.put('/api/products/:id', requireAdminAuth, (req, res) => {
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  const { name, price, category } = req.body || {};
  if (!name || !String(name).trim() || !category || !Number(price)) {
    return res.status(400).json({ success: false, message: 'Perfume name, category, and valid price are required' });
  }

  const updated = buildProductPayload(req.body, products[idx]);
  products[idx] = updated;
  saveProductsToFile();

  res.json({ success: true, message: 'Perfume updated!', product: updated });
});

// API: Delete perfume product
app.delete('/api/products/:id', requireAdminAuth, (req, res) => {
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  products.splice(idx, 1);
  saveProductsToFile();

  res.json({ success: true, message: 'Perfume removed from catalog' });
});

// API: Apply Coupon
app.post('/api/coupon', (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: 'Please enter a coupon code' });
  }

  const coupon = COUPONS[code.toUpperCase()];
  if (!coupon) {
    return res.status(400).json({ success: false, message: 'Invalid coupon code' });
  }

  if (subtotal < coupon.minOrder) {
    return res.status(400).json({
      success: false,
      message: `Minimum order amount of Rs. ${coupon.minOrder.toLocaleString()} required for this coupon`
    });
  }

  let discount = 0;
  if (coupon.type === 'percent') {
    discount = Math.round((subtotal * coupon.value) / 100);
  } else if (coupon.type === 'shipping') {
    discount = 250; // standard shipping waiver
  }

  res.json({
    success: true,
    code: code.toUpperCase(),
    discount,
    description: coupon.description
  });
});

// Persist orders helper
function saveOrdersToFile() {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders.slice(0, 200), null, 2));
  } catch (err) {
    console.error('Could not save order to file:', err.message);
  }
}

const VALID_ORDER_STATUSES = [
  'Confirmed - Processing Dispatch',
  'Dispatched / Shipped',
  'Delivered',
  'Cancelled'
];

// API: Place Order
app.post('/api/orders', (req, res) => {
  const { customer, items, paymentMethod, couponCode, pricing } = req.body;

  if (!customer || !customer.name || !customer.phone || !customer.address || !items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Please fill all required customer and cart details' });
  }

  const orderId = 'ALX-' + Math.floor(100000 + Math.random() * 900000);
  const trackingNumber = 'TRK-' + Date.now().toString().slice(-8);

  const newOrder = {
    orderId,
    trackingNumber,
    customer,
    items,
    paymentMethod: paymentMethod || 'cod',
    pricing: pricing || {},
    couponCode: couponCode || null,
    status: 'Confirmed - Processing Dispatch',
    createdAt: new Date().toISOString()
  };

  orders.unshift(newOrder);
  saveOrdersToFile();

  res.json({
    success: true,
    message: 'Your perfume order has been placed successfully!',
    order: newOrder
  });
});

// API: Get all orders & dashboard stats
app.get('/api/orders', requireAdminAuth, (req, res) => {
  const activeOrders = orders.filter(o => o.status !== 'Cancelled');
  const stats = {
    totalOrders: orders.length,
    totalRevenue: activeOrders.reduce((sum, o) => sum + Number(o.pricing?.total || 0), 0),
    pendingOrders: orders.filter(o => o.status === 'Confirmed - Processing Dispatch').length,
    dispatchedOrders: orders.filter(o => o.status === 'Dispatched / Shipped').length,
    deliveredOrders: orders.filter(o => o.status === 'Delivered').length
  };
  res.json({ success: true, count: orders.length, stats, orders });
});

// API: Update order status
app.patch('/api/orders/:orderId/status', requireAdminAuth, (req, res) => {
  const { status } = req.body;
  const order = orders.find(o => o.orderId === req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (!status || !VALID_ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid order status' });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  saveOrdersToFile();

  res.json({ success: true, order });
});

// API: Delete order
app.delete('/api/orders/:orderId', requireAdminAuth, (req, res) => {
  const idx = orders.findIndex(o => o.orderId === req.params.orderId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  orders.splice(idx, 1);
  saveOrdersToFile();

  res.json({ success: true, message: 'Order removed from dashboard' });
});

// Dedicated Orders Dashboard route
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`👑 AURA PARFUMS LUXURY STORE IS LIVE!`);
  console.log(`🌐 Localhost Link: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
