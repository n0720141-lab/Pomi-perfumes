const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const storage = require('./storage');

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
    // Serverless read-only filesystem fallback: deterministic across invocations
    return crypto
      .createHash('sha256')
      .update(process.env.SUPABASE_SERVICE_ROLE_KEY || ADMIN_PASSWORD_HASH)
      .digest('hex');
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
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax;${isHttps ? ' Secure;' : ''} Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
  res.json({ success: true, email: ADMIN_EMAIL });
});

app.post('/api/admin/logout', (req, res) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax;${isHttps ? ' Secure;' : ''} Max-Age=0`
  );
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

// Default catalog seed
const DEFAULT_PRODUCTS = require('./public/js/products-data.js');

// Coupon definitions
const COUPONS = {
  'LUXURY10': { type: 'percent', value: 10, minOrder: 3000, description: '10% Off Sitewide' },
  'FIRSTBUY': { type: 'percent', value: 15, minOrder: 5000, description: '15% Off Your First Order' },
  'FREESHIP': { type: 'shipping', value: 100, minOrder: 2000, description: 'Free Express Shipping' }
};

// API: Get products
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let result = await storage.getProducts(DEFAULT_PRODUCTS);

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
  } catch (err) {
    console.error('Get products error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load products' });
  }
});

// API: Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await storage.getProductById(req.params.id, DEFAULT_PRODUCTS);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    console.error('Get single product error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load product' });
  }
});

// API: Upload perfume image (base64 dataUrl -> local uploads or Supabase Storage)
app.post('/api/upload-image', requireAdminAuth, async (req, res) => {
  const { filename, dataUrl } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ success: false, message: 'Image data is required' });
  }

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
  if (!match) {
    return res.status(400).json({ success: false, message: 'Only PNG, JPG, WEBP, or GIF images are supported' });
  }

  const rawType = match[1].toLowerCase();
  const ext = rawType === 'jpeg' ? 'jpg' : rawType;
  const mimeType = `image/${rawType === 'jpg' ? 'jpeg' : rawType}`;
  const baseSlug = String(filename || 'perfume')
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'perfume';
  const finalName = `${baseSlug}-${Date.now()}.${ext}`;

  try {
    const buffer = Buffer.from(match[2], 'base64');
    const imagePath = await storage.saveUploadedImage(finalName, buffer, mimeType);
    res.json({ success: true, imagePath });
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
app.post('/api/products', requireAdminAuth, async (req, res) => {
  const { name, price, category } = req.body || {};
  if (!name || !String(name).trim() || !category || !Number(price)) {
    return res.status(400).json({ success: false, message: 'Perfume name, category, and valid price are required' });
  }

  try {
    const newProduct = buildProductPayload(req.body);
    await storage.addProduct(newProduct, DEFAULT_PRODUCTS);
    res.status(201).json({ success: true, message: 'Perfume added to store!', product: newProduct });
  } catch (err) {
    console.error('Add product error:', err.message);
    res.status(500).json({ success: false, message: 'Could not save perfume' });
  }
});

// API: Update existing perfume product
app.put('/api/products/:id', requireAdminAuth, async (req, res) => {
  const { name, price, category } = req.body || {};
  if (!name || !String(name).trim() || !category || !Number(price)) {
    return res.status(400).json({ success: false, message: 'Perfume name, category, and valid price are required' });
  }

  try {
    const updated = await storage.updateProduct(
      req.params.id,
      (existing) => buildProductPayload(req.body, existing),
      DEFAULT_PRODUCTS
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Perfume updated!', product: updated });
  } catch (err) {
    console.error('Update product error:', err.message);
    res.status(500).json({ success: false, message: 'Could not update perfume' });
  }
});

// API: Delete perfume product
app.delete('/api/products/:id', requireAdminAuth, async (req, res) => {
  try {
    const removed = await storage.deleteProduct(req.params.id, DEFAULT_PRODUCTS);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Perfume removed from catalog' });
  } catch (err) {
    console.error('Delete product error:', err.message);
    res.status(500).json({ success: false, message: 'Could not remove perfume' });
  }
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

const VALID_ORDER_STATUSES = [
  'Confirmed - Processing Dispatch',
  'Dispatched / Shipped',
  'Delivered',
  'Cancelled'
];

// API: Place Order
app.post('/api/orders', async (req, res) => {
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

  try {
    await storage.createOrder(newOrder);
    res.json({
      success: true,
      message: 'Your perfume order has been placed successfully!',
      order: newOrder
    });
  } catch (err) {
    console.error('Create order error:', err.message);
    res.status(500).json({ success: false, message: 'Could not place order right now' });
  }
});

// API: Get all orders & dashboard stats
app.get('/api/orders', requireAdminAuth, async (req, res) => {
  try {
    const orders = await storage.getOrders();
    const activeOrders = orders.filter(o => o.status !== 'Cancelled');
    const stats = {
      totalOrders: orders.length,
      totalRevenue: activeOrders.reduce((sum, o) => sum + Number(o.pricing?.total || 0), 0),
      pendingOrders: orders.filter(o => o.status === 'Confirmed - Processing Dispatch').length,
      dispatchedOrders: orders.filter(o => o.status === 'Dispatched / Shipped').length,
      deliveredOrders: orders.filter(o => o.status === 'Delivered').length
    };
    res.json({ success: true, count: orders.length, stats, orders });
  } catch (err) {
    console.error('Get orders error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load orders' });
  }
});

// API: Update order status
app.patch('/api/orders/:orderId/status', requireAdminAuth, async (req, res) => {
  const { status } = req.body;
  if (!status || !VALID_ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid order status' });
  }

  try {
    const order = await storage.updateOrderStatus(req.params.orderId, status);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, order });
  } catch (err) {
    console.error('Update order status error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
});

// API: Delete order
app.delete('/api/orders/:orderId', requireAdminAuth, async (req, res) => {
  try {
    const deleted = await storage.deleteOrder(req.params.orderId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, message: 'Order removed from dashboard' });
  } catch (err) {
    console.error('Delete order error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete order' });
  }
});

// Dedicated Orders Dashboard route
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`👑 AURA PARFUMS LUXURY STORE IS LIVE!`);
    console.log(`🌐 Localhost Link: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
