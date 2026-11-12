// ==================== POMI PERFUMES STORE DASHBOARD ====================
let allOrders = [];
let allProducts = [];
let activeStatusFilter = 'all';
let searchTerm = '';
let catalogSearchTerm = '';
let lastKnownTopOrderId = null;
let pendingUploadDataUrl = null;
let pendingUploadFilename = '';

const STATUS_OPTIONS = [
  'Confirmed - Processing Dispatch',
  'Dispatched / Shipped',
  'Delivered',
  'Cancelled'
];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatOrderDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return escapeHtml(iso);
  return d.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatPaymentLabel(pm) {
  if (!pm) return 'COD';
  if (pm === 'cod') return 'Cash on Delivery (COD)';
  if (pm === 'online') return 'Bank / JazzCash / EasyPaisa';
  return pm;
}

function normalizeWhatsAppPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return '92' + digits.slice(1);
  if (digits.startsWith('92')) return digits;
  return digits;
}

function getStatusClass(status) {
  if (status === 'Dispatched / Shipped') return 'status-dispatched';
  if (status === 'Delivered') return 'status-delivered';
  if (status === 'Cancelled') return 'status-cancelled';
  return 'status-pending';
}

function showDashToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid fa-bell"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3400);
}

async function fetchDashboardOrders(silent = false) {
  try {
    const res = await fetch('/api/orders');
    const json = await res.json();
    if (!json.success) return;

    const orders = json.orders || [];
    const topId = orders.length ? orders[0].orderId : null;
    if (silent && lastKnownTopOrderId && topId && topId !== lastKnownTopOrderId) {
      showDashToast(`New order received: #${topId}`);
    }
    lastKnownTopOrderId = topId;

    allOrders = orders;
    const tabOrdersCount = document.getElementById('tabOrdersCount');
    if (tabOrdersCount) tabOrdersCount.textContent = orders.length;
    updateStats(json.stats, orders);
    renderOrdersTable();

    const syncEl = document.getElementById('lastSyncText');
    if (syncEl) {
      syncEl.textContent = `Updated: ${new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
  } catch (err) {
    console.error('Dashboard fetch error:', err);
    if (!silent) {
      showDashToast('Could not load orders from server.');
    }
  }
}

function updateStats(serverStats, orders) {
  const activeOrders = orders.filter(o => o.status !== 'Cancelled');
  const totalOrders = serverStats ? serverStats.totalOrders : orders.length;
  const totalRevenue = serverStats
    ? serverStats.totalRevenue
    : activeOrders.reduce((s, o) => s + Number(o.pricing?.total || 0), 0);
  const pendingOrders = serverStats
    ? serverStats.pendingOrders
    : orders.filter(o => o.status === 'Confirmed - Processing Dispatch').length;
  const completedOrders = serverStats
    ? (serverStats.dispatchedOrders + serverStats.deliveredOrders)
    : orders.filter(o => o.status === 'Dispatched / Shipped' || o.status === 'Delivered').length;

  document.getElementById('statTotalOrders').textContent = totalOrders;
  document.getElementById('statTotalRevenue').textContent = `Rs. ${Number(totalRevenue).toLocaleString()}`;
  document.getElementById('statPendingOrders').textContent = pendingOrders;
  document.getElementById('statCompletedOrders').textContent = completedOrders;
}

function getFilteredOrders() {
  return allOrders.filter(order => {
    const matchesStatus = activeStatusFilter === 'all' || order.status === activeStatusFilter;
    if (!matchesStatus) return false;
    if (!searchTerm) return true;

    const q = searchTerm.toLowerCase();
    const c = order.customer || {};
    const itemsText = (order.items || []).map(i => `${i.name} ${i.size}`).join(' ');
    const haystack = [
      order.orderId,
      order.trackingNumber,
      c.name,
      c.phone,
      c.email,
      c.city,
      c.address,
      c.zip,
      c.country,
      itemsText
    ].join(' ').toLowerCase();

    return haystack.includes(q);
  });
}

function buildCustomerWhatsAppUrl(order) {
  const c = order.customer || {};
  const waPhone = normalizeWhatsAppPhone(c.phone);
  if (!waPhone) return '';
  const itemsText = (order.items || []).map(i => `• ${i.name} (${i.size}) x${i.qty}`).join('\n');
  const msg = [
    `Assalam o Alaikum ${c.name || ''},`,
    '',
    `Your POMI PERFUMES Order *#${order.orderId}* (Tracking: ${order.trackingNumber}) status is now: *${order.status}*.`,
    '',
    itemsText,
    `Total Payable: Rs. ${Number(order.pricing?.total || 0).toLocaleString()}`,
    '',
    'Thank you for shopping with Pomi Perfumes!'
  ].join('\n');
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
}

function renderOrdersTable() {
  const container = document.getElementById('dashOrdersContainer');
  const countLabel = document.getElementById('ordersCountLabel');
  const filtered = getFilteredOrders();

  if (countLabel) {
    countLabel.textContent = `Showing ${filtered.length} of ${allOrders.length} total orders`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `<p class="dash-empty-state">No orders found matching your filter.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="dash-orders-table">
      <thead>
        <tr>
          <th>Order & Time</th>
          <th>Customer</th>
          <th>Delivery Address</th>
          <th>Products Ordered</th>
          <th>Amount & Payment</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(order => {
          const c = order.customer || {};
          const items = order.items || [];
          const total = Number(order.pricing?.total || 0);
          const waCustomerUrl = buildCustomerWhatsAppUrl(order);
          const zipCountry = [c.zip, c.country].filter(Boolean).join(', ');
          return `
            <tr>
              <td class="order-id-cell">
                <strong class="text-gold">#${escapeHtml(order.orderId)}</strong>
                <span class="order-meta-sub">${escapeHtml(order.trackingNumber)}</span>
                <span class="order-meta-sub">${formatOrderDate(order.createdAt)}</span>
              </td>
              <td>
                <strong>${escapeHtml(c.name || 'Guest')}</strong>
                <span class="order-meta-sub"><i class="fa-solid fa-phone"></i> ${escapeHtml(c.phone || '-')}</span>
                ${c.email ? `<span class="order-meta-sub"><i class="fa-solid fa-envelope"></i> ${escapeHtml(c.email)}</span>` : ''}
              </td>
              <td>
                <strong>${escapeHtml(c.city || '-')}</strong>
                <span class="order-meta-sub">${escapeHtml(c.address || '-')}</span>
                ${zipCountry ? `<span class="order-meta-sub">${escapeHtml(zipCountry)}</span>` : ''}
                ${c.notes ? `<span class="order-meta-sub" style="color:var(--gold-light);">Note: ${escapeHtml(c.notes)}</span>` : ''}
              </td>
              <td>
                <ul class="order-items-mini">
                  ${items.map(i => `
                    <li>${escapeHtml(i.name)} <span style="color:var(--text-muted);">(${escapeHtml(i.size || '50ml')}) x${i.qty}</span></li>
                  `).join('')}
                </ul>
              </td>
              <td>
                <strong class="text-gold">Rs. ${total.toLocaleString()}</strong>
                <span class="order-meta-sub">${escapeHtml(formatPaymentLabel(order.paymentMethod))}</span>
              </td>
              <td>
                <select
                  class="status-select ${getStatusClass(order.status)}"
                  onchange="updateOrderStatus('${escapeHtml(order.orderId)}', this.value)"
                >
                  ${STATUS_OPTIONS.map(s => `
                    <option value="${escapeHtml(s)}" ${order.status === s ? 'selected' : ''}>${escapeHtml(s)}</option>
                  `).join('')}
                </select>
              </td>
              <td>
                <div class="dash-row-actions">
                  <button type="button" class="dash-icon-btn" onclick="openOrderDetail('${escapeHtml(order.orderId)}')" title="View full order slip">
                    <i class="fa-solid fa-eye"></i> View
                  </button>
                  ${waCustomerUrl ? `
                    <a href="${waCustomerUrl}" target="_blank" class="dash-icon-btn wa" title="Message customer on WhatsApp">
                      <i class="fa-brands fa-whatsapp"></i>
                    </a>
                  ` : ''}
                  <button type="button" class="dash-icon-btn del" onclick="deleteOrder('${escapeHtml(order.orderId)}')" title="Delete order">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      showDashToast(`Order #${orderId} updated to "${newStatus}"`);
      await fetchDashboardOrders(false);
    } else {
      showDashToast(json.message || 'Could not update status.');
    }
  } catch (err) {
    showDashToast('Error updating order status.');
  }
}

async function deleteOrder(orderId) {
  if (!confirm(`Are you sure you want to delete Order #${orderId}?`)) return;
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showDashToast(`Order #${orderId} deleted.`);
      await fetchDashboardOrders(false);
    } else {
      showDashToast(json.message || 'Could not delete order.');
    }
  } catch (err) {
    showDashToast('Error deleting order.');
  }
}

function openOrderDetail(orderId) {
  const order = allOrders.find(o => o.orderId === orderId);
  if (!order) return;

  const c = order.customer || {};
  const p = order.pricing || {};
  const waCustomerUrl = buildCustomerWhatsAppUrl(order);

  document.getElementById('orderDetailContent').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; padding-right:1.5rem;">
      <div>
        <span style="color:var(--gold-light); font-size:0.78rem; letter-spacing:0.08em; text-transform:uppercase;">POMI PERFUMES ORDER SLIP</span>
        <h3 style="font-family:'Cormorant Garamond', serif; font-size:1.8rem; color:#fff; margin-top:0.2rem;">#${escapeHtml(order.orderId)}</h3>
        <p style="font-size:0.82rem; color:var(--text-muted);">Tracking: ${escapeHtml(order.trackingNumber)} • ${formatOrderDate(order.createdAt)}</p>
      </div>
    </div>

    <div class="detail-section">
      <h4>Customer & Delivery Info</h4>
      <div class="detail-kv-grid">
        <div><span>Full Name</span><strong>${escapeHtml(c.name || '-')}</strong></div>
        <div><span>Phone / WhatsApp</span><strong>${escapeHtml(c.phone || '-')}</strong></div>
        <div><span>Email</span><strong>${escapeHtml(c.email || '-')}</strong></div>
        <div><span>City</span><strong>${escapeHtml(c.city || '-')}</strong></div>
        <div><span>ZIP / Postal Code</span><strong>${escapeHtml(c.zip || '-')}</strong></div>
        <div><span>Country</span><strong>${escapeHtml(c.country || 'Pakistan')}</strong></div>
      </div>
      <div style="margin-top:0.7rem; font-size:0.86rem;">
        <span style="display:block; color:var(--text-muted); font-size:0.74rem;">Complete Address</span>
        <strong>${escapeHtml(c.address || '-')}</strong>
      </div>
      ${c.notes ? `
        <div style="margin-top:0.65rem; font-size:0.84rem; color:var(--gold-light);">
          <strong>Special Instructions:</strong> ${escapeHtml(c.notes)}
        </div>
      ` : ''}
    </div>

    <div class="detail-section">
      <h4>Ordered Perfumes</h4>
      ${(order.items || []).map(i => `
        <div class="checkout-mini-item">
          <span>${escapeHtml(i.name)} (${escapeHtml(i.size || '50ml')}) x ${i.qty}</span>
          <strong>Rs. ${(Number(i.price || 0) * Number(i.qty || 1)).toLocaleString()}</strong>
        </div>
      `).join('')}
      <div class="checkout-totals">
        <div class="summary-line"><span>Subtotal:</span><span>Rs. ${Number(p.subtotal || 0).toLocaleString()}</span></div>
        ${p.discount ? `<div class="summary-line"><span>Discount:</span><span class="text-gold">- Rs. ${Number(p.discount).toLocaleString()}</span></div>` : ''}
        <div class="summary-line"><span>Delivery Charges:</span><span>${Number(p.shippingFee || 0) === 0 ? 'FREE' : `Rs. ${Number(p.shippingFee).toLocaleString()}`}</span></div>
        <div class="summary-line total-line"><span>Net Payable (${escapeHtml(formatPaymentLabel(order.paymentMethod))}):</span><span class="text-gold">Rs. ${Number(p.total || 0).toLocaleString()}</span></div>
      </div>
    </div>

    <div class="detail-section no-print" style="display:flex; gap:0.75rem; flex-wrap:wrap;">
      ${waCustomerUrl ? `
        <a href="${waCustomerUrl}" target="_blank" class="btn btn-whatsapp btn-sm" style="text-decoration:none;">
          <i class="fa-brands fa-whatsapp"></i> Message Customer on WhatsApp
        </a>
      ` : ''}
      <button type="button" class="btn btn-primary btn-sm" onclick="window.print()">
        <i class="fa-solid fa-print"></i> Print Slip
      </button>
    </div>
  `;

  document.getElementById('orderDetailModal').classList.add('active');
}

function closeOrderDetail() {
  document.getElementById('orderDetailModal').classList.remove('active');
}

// ==================== PERFUMES / CATALOG MANAGEMENT ====================
async function fetchDashboardProducts() {
  try {
    const res = await fetch('/api/products');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      allProducts = json.data;
      const tabCount = document.getElementById('tabProductsCount');
      if (tabCount) tabCount.textContent = allProducts.length;
      syncCategoryDropdownOptions();
      renderCatalogList();
    }
  } catch (err) {
    console.error('Products fetch error:', err);
  }
}

function syncCategoryDropdownOptions() {
  const select = document.getElementById('prodCategorySelect');
  if (!select) return;
  const known = new Set(['men', 'women', 'unisex', 'oud', 'attar', 'gift-sets', '__CUSTOM__']);
  const customOption = select.querySelector('option[value="__CUSTOM__"]');

  // Remove stale dynamic custom options before rebuilding
  Array.from(select.options).forEach(opt => {
    if (opt.dataset.dynamic === '1') opt.remove();
  });

  allProducts.forEach(p => {
    const cat = String(p.category || '').trim().toLowerCase();
    if (cat && !known.has(cat)) {
      known.add(cat);
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      opt.dataset.dynamic = '1';
      if (customOption) select.insertBefore(opt, customOption);
      else select.appendChild(opt);
    }
  });
}

function renderCatalogList() {
  const container = document.getElementById('dashProductsContainer');
  const countLabel = document.getElementById('catalogCountLabel');
  if (!container) return;

  const q = catalogSearchTerm.toLowerCase();
  const filtered = q
    ? allProducts.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.badge || '').toLowerCase().includes(q)
      )
    : allProducts;

  if (countLabel) {
    countLabel.textContent = `Showing ${filtered.length} of ${allProducts.length} perfumes on website`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `<p class="dash-empty-state">No perfumes found matching "${escapeHtml(catalogSearchTerm)}".</p>`;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const primarySize = p.sizes?.[0]?.size || '50ml';
    const sizesText = (p.sizes || []).map(s => `${escapeHtml(s.size)}: Rs. ${Number(s.price).toLocaleString()}`).join(' • ');
    const imgSrc = p.image.startsWith('http') || p.image.startsWith('/') ? p.image : `/${p.image}`;
    return `
      <div class="dash-prod-item">
        <div class="dash-prod-left">
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" class="dash-prod-thumb">
          <div class="dash-prod-meta">
            <h4>${escapeHtml(p.name)}</h4>
            <div class="dash-prod-sub">
              <span class="dash-cat-pill">${escapeHtml(p.category)}</span>
              <span>${sizesText || `${escapeHtml(primarySize)}: Rs. ${Number(p.price).toLocaleString()}`}</span>
            </div>
          </div>
        </div>
        <div class="dash-row-actions">
          <button type="button" class="dash-icon-btn" onclick="editPerfume('${escapeHtml(p.id)}')" title="Edit perfume">
            <i class="fa-solid fa-pen-to-square"></i> Edit
          </button>
          <button type="button" class="dash-icon-btn del" onclick="deletePerfume('${escapeHtml(p.id)}', '${escapeHtml(p.name)}')" title="Delete perfume">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function handlePerfumeImagePick(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const statusEl = document.getElementById('uploadFileStatus');
  const previewEl = document.getElementById('prodImagePreview');
  const pathInput = document.getElementById('prodImagePath');

  if (file.size > 10 * 1024 * 1024) {
    showDashToast('Image must be smaller than 10 MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    pendingUploadDataUrl = reader.result;
    pendingUploadFilename = file.name;
    if (previewEl) previewEl.src = reader.result;
    if (statusEl) statusEl.textContent = `Selected: ${file.name}`;
    if (pathInput && !pathInput.value.trim()) {
      pathInput.value = `images/uploads/${file.name}`;
    }
  };
  reader.readAsDataURL(file);
}

function resetPerfumeForm() {
  const form = document.getElementById('perfumeManageForm');
  if (form) form.reset();
  document.getElementById('editingProductId').value = '';
  document.getElementById('prodPrimarySize').value = '50ml';
  document.getElementById('prodBadge').value = 'New Launch';
  document.getElementById('prodLongevity').value = '16+ Hours';
  document.getElementById('prodImagePreview').src = '/images/pomi-collection.jpg';
  document.getElementById('uploadFileStatus').textContent = 'JPG, PNG, or WEBP';
  document.getElementById('customCategoryGroup').style.display = 'none';
  document.getElementById('perfumeFormTitle').innerHTML = `<i class="fa-solid fa-plus-circle text-gold"></i> Add New Perfume`;
  document.getElementById('savePerfumeBtn').innerHTML = `<i class="fa-solid fa-plus"></i> <span>Add Perfume to Website</span>`;
  document.getElementById('cancelEditPerfumeBtn').style.display = 'none';
  pendingUploadDataUrl = null;
  pendingUploadFilename = '';
}

function editPerfume(productId) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;

  document.getElementById('editingProductId').value = prod.id;
  document.getElementById('prodName').value = prod.name || '';
  document.getElementById('prodPrice').value = prod.price || '';
  document.getElementById('prodOriginalPrice').value = prod.originalPrice || '';
  document.getElementById('prodPrimarySize').value = prod.sizes?.[0]?.size || '50ml';
  document.getElementById('prodSecondarySize').value = prod.sizes?.[1]?.size || '';
  document.getElementById('prodSecondaryPrice').value = prod.sizes?.[1]?.price || '';
  document.getElementById('prodImagePath').value = prod.image || '';
  document.getElementById('prodImagePreview').src = prod.image.startsWith('http') || prod.image.startsWith('/') ? prod.image : `/${prod.image}`;
  document.getElementById('prodBadge').value = prod.badge || '';
  document.getElementById('prodConcentration').value = prod.concentration || 'Extrait de Parfum';
  document.getElementById('prodGender').value = prod.gender || 'Unisex';
  document.getElementById('prodLongevity').value = prod.longevity || '14+ Hours';
  document.getElementById('prodTagline').value = prod.tagline || '';
  document.getElementById('prodDescription').value = prod.description || '';
  document.getElementById('prodTopNotes').value = (prod.notes?.top || []).join(', ');
  document.getElementById('prodHeartNotes').value = (prod.notes?.heart || []).join(', ');
  document.getElementById('prodBaseNotes').value = (prod.notes?.base || []).join(', ');

  const catSelect = document.getElementById('prodCategorySelect');
  const catVal = String(prod.category || 'unisex').toLowerCase();
  if (Array.from(catSelect.options).some(o => o.value === catVal)) {
    catSelect.value = catVal;
    document.getElementById('customCategoryGroup').style.display = 'none';
  } else {
    catSelect.value = '__CUSTOM__';
    document.getElementById('customCategoryGroup').style.display = 'block';
    document.getElementById('prodCustomCategory').value = catVal;
  }

  pendingUploadDataUrl = null;
  pendingUploadFilename = '';
  document.getElementById('uploadFileStatus').textContent = 'Keep current photo or upload new';
  document.getElementById('perfumeFormTitle').innerHTML = `<i class="fa-solid fa-pen-to-square text-gold"></i> Edit Perfume`;
  document.getElementById('savePerfumeBtn').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> <span>Update Perfume</span>`;
  document.getElementById('cancelEditPerfumeBtn').style.display = 'inline-flex';
  document.getElementById('perfumeFormCard').scrollIntoView({ behavior: 'smooth' });
}

async function handlePerfumeFormSubmit(e) {
  e.preventDefault();

  const saveBtn = document.getElementById('savePerfumeBtn');
  const prevBtnHtml = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving Perfume...`;

  try {
    let imagePath = document.getElementById('prodImagePath').value.trim();

    if (pendingUploadDataUrl) {
      const uploadRes = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: pendingUploadFilename,
          dataUrl: pendingUploadDataUrl
        })
      });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.success) {
        showDashToast(uploadJson.message || 'Image upload failed.');
        return;
      }
      imagePath = uploadJson.imagePath;
    }

    if (!imagePath) {
      showDashToast('Please upload a perfume picture or provide an image path.');
      return;
    }

    const catSelectVal = document.getElementById('prodCategorySelect').value;
    const category = catSelectVal === '__CUSTOM__'
      ? document.getElementById('prodCustomCategory').value.trim()
      : catSelectVal;

    if (!category) {
      showDashToast('Please enter a category name.');
      return;
    }

    const editingId = document.getElementById('editingProductId').value.trim();
    const payload = {
      name: document.getElementById('prodName').value.trim(),
      category,
      price: Number(document.getElementById('prodPrice').value),
      originalPrice: Number(document.getElementById('prodOriginalPrice').value) || null,
      primarySize: document.getElementById('prodPrimarySize').value.trim() || '50ml',
      secondarySize: document.getElementById('prodSecondarySize').value.trim(),
      secondaryPrice: Number(document.getElementById('prodSecondaryPrice').value) || null,
      image: imagePath,
      badge: document.getElementById('prodBadge').value.trim(),
      concentration: document.getElementById('prodConcentration').value,
      gender: document.getElementById('prodGender').value,
      longevity: document.getElementById('prodLongevity').value.trim(),
      tagline: document.getElementById('prodTagline').value.trim(),
      description: document.getElementById('prodDescription').value.trim(),
      topNotes: document.getElementById('prodTopNotes').value.trim(),
      heartNotes: document.getElementById('prodHeartNotes').value.trim(),
      baseNotes: document.getElementById('prodBaseNotes').value.trim()
    };

    const url = editingId ? `/api/products/${encodeURIComponent(editingId)}` : '/api/products';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (json.success) {
      showDashToast(editingId ? `"${payload.name}" updated!` : `"${payload.name}" added to website!`);
      resetPerfumeForm();
      await fetchDashboardProducts();
    } else {
      showDashToast(json.message || 'Could not save perfume.');
    }
  } catch (err) {
    console.error('Save perfume error:', err);
    showDashToast('Error saving perfume. Please try again.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = prevBtnHtml;
  }
}

async function deletePerfume(productId, productName) {
  if (!confirm(`Remove "${productName}" from the website catalog?`)) return;
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showDashToast(`"${productName}" removed from website.`);
      if (document.getElementById('editingProductId').value === productId) {
        resetPerfumeForm();
      }
      await fetchDashboardProducts();
    } else {
      showDashToast(json.message || 'Could not remove perfume.');
    }
  } catch (err) {
    showDashToast('Error deleting perfume.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchDashboardOrders(false);
  fetchDashboardProducts();

  // Dashboard Tab Switcher
  document.querySelectorAll('.dash-nav-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.dash-nav-tab').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      const target = tabBtn.dataset.tab;
      document.getElementById('ordersTabView').classList.toggle('active', target === 'orders');
      document.getElementById('productsTabView').classList.toggle('active', target === 'products');
    });
  });

  document.getElementById('refreshOrdersBtn').addEventListener('click', () => {
    fetchDashboardOrders(false);
    fetchDashboardProducts();
  });

  document.getElementById('dashSearchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value.trim();
    renderOrdersTable();
  });

  document.querySelectorAll('#statusFilterPills .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#statusFilterPills .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStatusFilter = btn.dataset.status;
      renderOrdersTable();
    });
  });

  document.getElementById('closeOrderDetailBtn').addEventListener('click', closeOrderDetail);
  document.getElementById('orderDetailModal').addEventListener('click', (e) => {
    if (e.target.id === 'orderDetailModal') closeOrderDetail();
  });

  // Perfume Manager Listeners
  document.getElementById('prodCategorySelect').addEventListener('change', (e) => {
    const isCustom = e.target.value === '__CUSTOM__';
    document.getElementById('customCategoryGroup').style.display = isCustom ? 'block' : 'none';
    const customInput = document.getElementById('prodCustomCategory');
    if (customInput) customInput.required = isCustom;
  });

  document.getElementById('prodImageFile').addEventListener('change', handlePerfumeImagePick);
  document.getElementById('prodImagePath').addEventListener('input', (e) => {
    const v = e.target.value.trim();
    if (v && !pendingUploadDataUrl) {
      document.getElementById('prodImagePreview').src = v.startsWith('http') || v.startsWith('/') ? v : `/${v}`;
    }
  });
  document.getElementById('perfumeManageForm').addEventListener('submit', handlePerfumeFormSubmit);
  document.getElementById('cancelEditPerfumeBtn').addEventListener('click', resetPerfumeForm);
  document.getElementById('catalogSearchInput').addEventListener('input', (e) => {
    catalogSearchTerm = e.target.value.trim();
    renderCatalogList();
  });

  setInterval(() => fetchDashboardOrders(true), 8000);
});
