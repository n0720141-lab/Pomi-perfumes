const fs = require('fs');
const path = require('path');

const ORDERS_FILE = path.join(__dirname, 'orders.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'images', 'uploads');
const STORAGE_BUCKET = 'perfume-images';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

// ==================== LOCAL JSON FALLBACK ====================
function readJsonSafe(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error(`Error reading ${path.basename(filePath)}:`, err.message);
  }
  return fallback;
}

function writeJsonSafe(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${path.basename(filePath)}:`, err.message);
  }
}

// ==================== SUPABASE REST HELPERS ====================
async function supabaseRequest(endpoint, options = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...(options.headers || {})
  };
  const res = await fetch(`${SUPABASE_URL}${endpoint}`, {
    ...options,
    headers
  });
  return res;
}

let bucketChecked = false;
async function ensurePublicBucket() {
  if (bucketChecked) return;
  const checkRes = await supabaseRequest(`/storage/v1/bucket/${STORAGE_BUCKET}`);
  if (checkRes.status === 404 || checkRes.status === 400) {
    await supabaseRequest('/storage/v1/bucket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: STORAGE_BUCKET,
        name: STORAGE_BUCKET,
        public: true
      })
    });
  }
  bucketChecked = true;
}

// ==================== ORDERS STORAGE ====================
async function getOrders() {
  if (!USE_SUPABASE) {
    return readJsonSafe(ORDERS_FILE, []);
  }
  const res = await supabaseRequest('/rest/v1/orders?select=data&order=created_at.desc&limit=200');
  if (!res.ok) {
    throw new Error(`Supabase getOrders failed (${res.status}): ${await res.text()}`);
  }
  const rows = await res.json();
  return rows.map(r => r.data);
}

async function createOrder(order) {
  if (!USE_SUPABASE) {
    const orders = readJsonSafe(ORDERS_FILE, []);
    orders.unshift(order);
    writeJsonSafe(ORDERS_FILE, orders.slice(0, 200));
    return order;
  }
  const res = await supabaseRequest('/rest/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      order_id: order.orderId,
      data: order,
      created_at: order.createdAt
    })
  });
  if (!res.ok) {
    throw new Error(`Supabase createOrder failed (${res.status}): ${await res.text()}`);
  }
  return order;
}

async function updateOrderStatus(orderId, status) {
  if (!USE_SUPABASE) {
    const orders = readJsonSafe(ORDERS_FILE, []);
    const order = orders.find(o => o.orderId === orderId);
    if (!order) return null;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    writeJsonSafe(ORDERS_FILE, orders.slice(0, 200));
    return order;
  }

  const getRes = await supabaseRequest(`/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}&select=data`);
  if (!getRes.ok) throw new Error(`Supabase fetch order failed (${getRes.status})`);
  const rows = await getRes.json();
  if (!rows.length) return null;

  const updated = {
    ...rows[0].data,
    status,
    updatedAt: new Date().toISOString()
  };

  const patchRes = await supabaseRequest(`/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: updated })
  });
  if (!patchRes.ok) throw new Error(`Supabase updateOrderStatus failed (${patchRes.status})`);
  return updated;
}

async function deleteOrder(orderId) {
  if (!USE_SUPABASE) {
    const orders = readJsonSafe(ORDERS_FILE, []);
    const idx = orders.findIndex(o => o.orderId === orderId);
    if (idx === -1) return false;
    orders.splice(idx, 1);
    writeJsonSafe(ORDERS_FILE, orders.slice(0, 200));
    return true;
  }

  const res = await supabaseRequest(`/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' }
  });
  if (!res.ok) throw new Error(`Supabase deleteOrder failed (${res.status})`);
  const deleted = await res.json();
  return deleted.length > 0;
}

// ==================== PRODUCTS STORAGE ====================
async function getProducts(defaultProducts) {
  if (!USE_SUPABASE) {
    const local = readJsonSafe(PRODUCTS_FILE, null);
    if (local && local.length > 0) return local;
    const seeded = [...defaultProducts];
    writeJsonSafe(PRODUCTS_FILE, seeded);
    return seeded;
  }

  const res = await supabaseRequest('/rest/v1/products?select=data&order=created_at.desc');
  if (!res.ok) {
    throw new Error(`Supabase getProducts failed (${res.status}): ${await res.text()}`);
  }
  const rows = await res.json();
  if (rows.length > 0) {
    return rows.map(r => r.data);
  }

  // Auto-seed default perfumes on first run when Supabase products table is empty
  const now = Date.now();
  const seedRows = defaultProducts.map((p, idx) => ({
    id: p.id,
    data: p,
    created_at: new Date(now - idx * 1000).toISOString()
  }));
  const seedRes = await supabaseRequest('/rest/v1/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates'
    },
    body: JSON.stringify(seedRows)
  });
  if (!seedRes.ok) {
    console.warn('Could not auto-seed Supabase products:', await seedRes.text());
  }
  return [...defaultProducts];
}

async function getProductById(id, defaultProducts) {
  const list = await getProducts(defaultProducts);
  return list.find(p => p.id === id) || null;
}

async function addProduct(product, defaultProducts) {
  if (!USE_SUPABASE) {
    const list = await getProducts(defaultProducts);
    list.unshift(product);
    writeJsonSafe(PRODUCTS_FILE, list);
    return product;
  }

  const res = await supabaseRequest('/rest/v1/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: product.id,
      data: product,
      created_at: new Date().toISOString()
    })
  });
  if (!res.ok) {
    throw new Error(`Supabase addProduct failed (${res.status}): ${await res.text()}`);
  }
  return product;
}

async function updateProduct(id, buildFn, defaultProducts) {
  if (!USE_SUPABASE) {
    const list = await getProducts(defaultProducts);
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return null;
    const updated = buildFn(list[idx]);
    list[idx] = updated;
    writeJsonSafe(PRODUCTS_FILE, list);
    return updated;
  }

  const getRes = await supabaseRequest(`/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=data`);
  if (!getRes.ok) throw new Error(`Supabase fetch product failed (${getRes.status})`);
  const rows = await getRes.json();
  if (!rows.length) return null;

  const updated = buildFn(rows[0].data);
  const patchRes = await supabaseRequest(`/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: updated })
  });
  if (!patchRes.ok) throw new Error(`Supabase updateProduct failed (${patchRes.status})`);
  return updated;
}

async function deleteProduct(id, defaultProducts) {
  if (!USE_SUPABASE) {
    const list = await getProducts(defaultProducts);
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    writeJsonSafe(PRODUCTS_FILE, list);
    return true;
  }

  const res = await supabaseRequest(`/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' }
  });
  if (!res.ok) throw new Error(`Supabase deleteProduct failed (${res.status})`);
  const deleted = await res.json();
  return deleted.length > 0;
}

// ==================== IMAGE UPLOAD STORAGE ====================
async function saveUploadedImage(finalName, buffer, mimeType) {
  if (!USE_SUPABASE) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, finalName), buffer);
    return `images/uploads/${finalName}`;
  }

  await ensurePublicBucket();
  const uploadRes = await supabaseRequest(`/storage/v1/object/${STORAGE_BUCKET}/${finalName}`, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      'x-upsert': 'true'
    },
    body: buffer
  });
  if (!uploadRes.ok) {
    throw new Error(`Supabase image upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${finalName}`;
}

module.exports = {
  USE_SUPABASE,
  getOrders,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  getProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  saveUploadedImage
};
