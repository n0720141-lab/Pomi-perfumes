const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
app.post('/api/upload-image', (req, res) => {
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
app.post('/api/products', (req, res) => {
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
app.put('/api/products/:id', (req, res) => {
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
app.delete('/api/products/:id', (req, res) => {
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
app.get('/api/orders', (req, res) => {
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
app.patch('/api/orders/:orderId/status', (req, res) => {
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
app.delete('/api/orders/:orderId', (req, res) => {
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
