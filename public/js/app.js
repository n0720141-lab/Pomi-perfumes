/* =====================================================
   AURA PARFUMS - FRONTEND LOGIC & E-COMMERCE ENGINE
   ===================================================== */

// State Management
let productsData = typeof PRODUCTS !== 'undefined' ? PRODUCTS : [];
let currentCategory = 'all';
let currentSearch = '';
let currentSort = 'featured';
let currentQuizFilter = 'all';

// Cart & Wishlist stored in localStorage
let cart = JSON.parse(localStorage.getItem('aura_cart') || '[]');
let wishlist = JSON.parse(localStorage.getItem('aura_wishlist') || '[]');
let activeCoupon = null; // { code, discount, description }

const FREE_SHIPPING_THRESHOLD = 5000;
const STANDARD_SHIPPING_FEE = 250;
const WHATSAPP_PHONE = '923276018810';
const WHATSAPP_PHONE_2 = '923017825827';
const STORE_EMAIL = 'muhammadahmad4305@gmail.com';

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const resultsCountEl = document.getElementById('resultsCount');
const currentFilterTagEl = document.getElementById('currentFilterTag');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const categoryTabsContainer = document.getElementById('categoryTabs');
const navLinks = document.querySelectorAll('.nav-link');
const quizButtons = document.querySelectorAll('.quiz-pill-btn');

// Cart Elements
const cartDrawer = document.getElementById('cartDrawer');
const cartOverlay = document.getElementById('cartOverlay');
const cartToggleBtn = document.getElementById('cartToggleBtn');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartItemsList = document.getElementById('cartItemsList');
const cartDrawerCount = document.getElementById('cartDrawerCount');
const cartCountBadge = document.getElementById('cartCount');
const navCartSubtotal = document.getElementById('navCartSubtotal');
const cartSubtotalText = document.getElementById('cartSubtotalText');
const cartShippingText = document.getElementById('cartShippingText');
const cartTotalText = document.getElementById('cartTotalText');
const discountLine = document.getElementById('discountLine');
const activeCouponLabel = document.getElementById('activeCouponLabel');
const discountAmountText = document.getElementById('discountAmountText');
const shippingProgressFill = document.getElementById('shippingProgressFill');
const shippingAmountNeeded = document.getElementById('shippingAmountNeeded');

// Wishlist Elements
const wishlistDrawer = document.getElementById('wishlistDrawer');
const wishlistOverlay = document.getElementById('wishlistOverlay');
const wishlistToggleBtn = document.getElementById('wishlistToggleBtn');
const closeWishlistBtn = document.getElementById('closeWishlistBtn');
const wishlistCountBadge = document.getElementById('wishlistCount');
const wishlistDrawerCount = document.getElementById('wishlistDrawerCount');
const wishlistItemsList = document.getElementById('wishlistItemsList');

// Modals
const productModalOverlay = document.getElementById('productModalOverlay');
const closeProductModalBtn = document.getElementById('closeProductModalBtn');
const productModalContent = document.getElementById('productModalContent');

const checkoutModalOverlay = document.getElementById('checkoutModalOverlay');
const closeCheckoutModalBtn = document.getElementById('closeCheckoutModalBtn');
const proceedCheckoutBtn = document.getElementById('proceedCheckoutBtn');
const checkoutForm = document.getElementById('checkoutForm');
const checkoutItemsList = document.getElementById('checkoutItemsList');
const checkoutSubtotal = document.getElementById('checkoutSubtotal');
const checkoutDiscount = document.getElementById('checkoutDiscount');
const checkoutDiscountLine = document.getElementById('checkoutDiscountLine');
const checkoutShipping = document.getElementById('checkoutShipping');
const checkoutFinalTotal = document.getElementById('checkoutFinalTotal');

const orderSuccessModal = document.getElementById('orderSuccessModal');

// Init
document.addEventListener('DOMContentLoaded', () => {
  fetchProducts();
  updateCartUI();
  updateWishlistUI();
  setupEventListeners();
});

// Fetch products from API or fallback
async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    const json = await res.json();
    if (json.success && json.data) {
      productsData = json.data;
    }
  } catch (err) {
    console.warn('Using local products data');
  }
  renderCategoryTabs();
  renderProducts();
  populateInlineOrderSelect();
  populateCheckoutProductSelect();
}

const DEFAULT_STORE_CATEGORIES = [
  { id: 'men', label: 'Men' },
  { id: 'women', label: 'Women' },
  { id: 'unisex', label: 'Unisex' },
  { id: 'oud', label: 'Royal Oud' },
  { id: 'attar', label: 'Pure Attar' },
  { id: 'gift-sets', label: 'Gift Sets' }
];

function formatCategoryTitle(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function renderCategoryTabs() {
  if (!categoryTabsContainer) return;
  const knownIds = new Set(DEFAULT_STORE_CATEGORIES.map(c => c.id));
  const extraCategories = [];
  productsData.forEach(p => {
    const cat = String(p.category || '').trim().toLowerCase();
    if (cat && cat !== 'all' && !knownIds.has(cat)) {
      knownIds.add(cat);
      extraCategories.push({ id: cat, label: formatCategoryTitle(cat) });
    }
  });

  const allTabs = [
    { id: 'all', label: `All (${productsData.length})` },
    ...DEFAULT_STORE_CATEGORIES,
    ...extraCategories
  ];

  categoryTabsContainer.innerHTML = allTabs.map(c => `
    <button class="cat-tab ${currentCategory === c.id ? 'active' : ''}" data-category="${c.id}">${c.label}</button>
  `).join('');
}

function syncCategoryTabs(cat) {
  if (!categoryTabsContainer) return;
  categoryTabsContainer.querySelectorAll('.cat-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.category === cat);
  });
}

// Setup Event Listeners
function setupEventListeners() {
  // Mobile Nav Toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      navMenu.classList.toggle('mobile-open');
    });
  }

  // Live Search
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim().toLowerCase();
    renderProducts();
  });

  // Sort dropdown
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderProducts();
  });

  // Category Tabs (delegated so dynamically added categories also work)
  if (categoryTabsContainer) {
    categoryTabsContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      currentCategory = tab.dataset.category;
      syncCategoryTabs(currentCategory);
      currentQuizFilter = 'all';
      updateQuizButtons();
      renderProducts();
    });
  }

  // Header Nav Links
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const filter = link.dataset.filter;
      if (filter) {
        currentCategory = filter;
        currentQuizFilter = 'all';
        syncCategoryTabs(filter);
        updateQuizButtons();
        renderProducts();
      }
      if (navMenu.classList.contains('mobile-open')) {
        navMenu.classList.remove('mobile-open');
      }
    });
  });

  // Scent Quiz Buttons
  quizButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      quizButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentQuizFilter = btn.dataset.quiz;
      renderProducts();
      // Smooth scroll to catalog
      document.getElementById('collections').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Cart Drawer open/close
  cartToggleBtn.addEventListener('click', openCart);
  closeCartBtn.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);

  // Wishlist open/close
  wishlistToggleBtn.addEventListener('click', openWishlist);
  closeWishlistBtn.addEventListener('click', closeWishlist);
  wishlistOverlay.addEventListener('click', closeWishlist);

  // Coupon apply
  const applyCouponBtn = document.getElementById('applyCouponBtn');
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', handleApplyCoupon);
  }

  // Checkout open/close
  proceedCheckoutBtn.addEventListener('click', () => {
    if (cart.length === 0) {
      showToast('Your cart is empty');
      return;
    }
    closeCart();
    openCheckout();
  });
  closeCheckoutModalBtn.addEventListener('click', closeCheckout);

  // Order WhatsApp in Cart
  const cartWhatsAppOrderBtn = document.getElementById('cartWhatsAppOrderBtn');
  if (cartWhatsAppOrderBtn) {
    cartWhatsAppOrderBtn.addEventListener('click', orderCartViaWhatsApp);
  }

  // Checkout form submit & product picker
  checkoutForm.addEventListener('submit', handleCheckoutSubmit);
  const checkoutAddProductBtn = document.getElementById('checkoutAddProductBtn');
  if (checkoutAddProductBtn) {
    checkoutAddProductBtn.addEventListener('click', addProductFromCheckoutPicker);
  }

  // Inline Order Form submit & quantity sync
  const inlineOrderForm = document.getElementById('inlineOrderForm');
  if (inlineOrderForm) {
    inlineOrderForm.addEventListener('submit', handleInlineOrderSubmit);
  }
  const inlineProductSelect = document.getElementById('inlineProductSelect');
  if (inlineProductSelect) {
    inlineProductSelect.addEventListener('change', syncInlineQtyState);
  }
  const inlineProductQty = document.getElementById('inlineProductQty');
  if (inlineProductQty) {
    inlineProductQty.addEventListener('input', renderInlineProductPreview);
    inlineProductQty.addEventListener('change', renderInlineProductPreview);
  }

  // Close modals on overlay click
  productModalOverlay.addEventListener('click', (e) => {
    if (e.target === productModalOverlay) closeProductModal();
  });
  checkoutModalOverlay.addEventListener('click', (e) => {
    if (e.target === checkoutModalOverlay) closeCheckout();
  });
  closeProductModalBtn.addEventListener('click', closeProductModal);
}

function updateQuizButtons() {
  quizButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.quiz === currentQuizFilter);
  });
}

// Filter and Render Products
function renderProducts() {
  let filtered = [...productsData];

  // Category filter
  if (currentCategory !== 'all') {
    filtered = filtered.filter(p => p.category.toLowerCase() === currentCategory.toLowerCase());
  }

  // Quiz / Vibe filter
  if (currentQuizFilter !== 'all') {
    if (currentQuizFilter === 'oud') {
      filtered = filtered.filter(p => p.category === 'oud' || p.name.toLowerCase().includes('oud') || p.notes?.base?.some(n => n.toLowerCase().includes('oud')));
    } else if (currentQuizFilter === 'fresh') {
      filtered = filtered.filter(p => p.name.toLowerCase().includes('citrus') || p.tagline.toLowerCase().includes('marine') || p.notes?.top?.some(n => n.toLowerCase().includes('citrus') || n.toLowerCase().includes('bergamot') || n.toLowerCase().includes('grapefruit')));
    } else if (currentQuizFilter === 'sweet') {
      filtered = filtered.filter(p => p.notes?.base?.some(n => n.toLowerCase().includes('vanilla') || n.toLowerCase().includes('tonka')));
    } else if (currentQuizFilter === 'floral') {
      filtered = filtered.filter(p => p.category === 'women' || p.notes?.heart?.some(n => n.toLowerCase().includes('rose') || n.toLowerCase().includes('jasmine')));
    }
  }

  // Search filter
  if (currentSearch) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(currentSearch) ||
      p.tagline.toLowerCase().includes(currentSearch) ||
      p.description.toLowerCase().includes(currentSearch) ||
      (p.notes && Object.values(p.notes).flat().some(n => n.toLowerCase().includes(currentSearch)))
    );
  }

  // Sort
  if (currentSort === 'price-asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (currentSort === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  }

  // Update UI counts
  resultsCountEl.textContent = `Showing ${filtered.length} of ${productsData.length} perfumes`;
  currentFilterTagEl.textContent = `Filter: ${currentCategory.toUpperCase()}${currentQuizFilter !== 'all' ? ' + ' + currentQuizFilter.toUpperCase() : ''}`;

  if (filtered.length === 0) {
    productsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
        <i class="fa-solid fa-flask" style="font-size: 3rem; color: var(--gold-primary); margin-bottom: 1rem; opacity: 0.5;"></i>
        <h3 style="font-size: 1.5rem; color: #fff; margin-bottom: 0.5rem;">No fragrances match your criteria</h3>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Try adjusting your search terms or filters.</p>
        <button class="btn btn-outline" onclick="resetFilters()">View All Perfumes</button>
      </div>
    `;
    return;
  }

  productsGrid.innerHTML = filtered.map(product => {
    const isWishlisted = wishlist.includes(product.id);
    const topNotes = product.notes?.top ? product.notes.top.slice(0, 3).join(', ') : 'Exquisite Notes';
    return `
      <article class="product-card" data-id="${product.id}">
        <div class="card-image-wrap" onclick="openProductModal('${product.id}')">
          <img src="${product.image}" alt="${product.name}" class="card-img" loading="lazy">
          <span class="card-badge">${product.badge || 'Extrait'}</span>
          <button class="wishlist-heart-btn ${isWishlisted ? 'active' : ''}" 
                  onclick="event.stopPropagation(); toggleWishlist('${product.id}')"
                  title="${isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}">
            <i class="${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
          </button>
          <button class="card-overlay-btn" onclick="event.stopPropagation(); openProductModal('${product.id}')">
            <i class="fa-solid fa-eye"></i> Olfactory Notes
          </button>
        </div>

        <div class="card-body">
          <div class="card-concentration">${product.concentration} • ${product.gender}</div>
          <h3 class="card-title" onclick="openProductModal('${product.id}')">${product.name}</h3>
          <p class="card-tagline">${product.tagline}</p>

          <div class="card-notes-chips">
            <span class="note-chip"><i class="fa-solid fa-sparkles"></i> Top: ${topNotes}</span>
          </div>

          <div class="card-longevity-badge">
            <i class="fa-solid fa-stopwatch"></i>
            <span>Longevity: <strong>${product.longevity}</strong></span>
          </div>

          <div class="card-price-row">
            <div class="card-prices">
              <span class="current-price">Rs. ${product.price.toLocaleString()}</span>
              ${product.originalPrice ? `<span class="old-price">Rs. ${product.originalPrice.toLocaleString()}</span>` : ''}
            </div>
            <span class="card-size-label">${product.sizes?.[0]?.size || '50ml'}</span>
          </div>

          <div class="card-actions-row">
            <button class="card-btn-add" onclick="addToCart('${product.id}')">
              <i class="fa-solid fa-bag-shopping"></i> Add to Bag
            </button>
            <a href="https://wa.me/${WHATSAPP_PHONE}?text=Assalam%20o%20Alaikum%20Hafiz%20Muhammad%20Ahmad%2C%20I%20want%20to%20order%20*${encodeURIComponent(product.name)}*%20(Rs.%20${product.price})" 
               target="_blank" class="card-btn-wa" title="Order on WhatsApp (0327-6018810)">
              <i class="fa-brands fa-whatsapp"></i>
            </a>
            <a href="mailto:${STORE_EMAIL}?subject=${encodeURIComponent('Order: ' + product.name + ' - Pomi Perfumes')}&body=${encodeURIComponent('Assalam o Alaikum Hafiz Muhammad Ahmad,\n\nI would like to order:\nPerfume: ' + product.name + '\nPrice: Rs. ' + product.price + '\n\nPlease share delivery details.')}" 
               class="card-btn-mail" title="Order via Email (${STORE_EMAIL})">
              <i class="fa-solid fa-envelope"></i>
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function resetFilters() {
  currentCategory = 'all';
  currentQuizFilter = 'all';
  currentSearch = '';
  searchInput.value = '';
  syncCategoryTabs('all');
  updateQuizButtons();
  renderProducts();
}

function filterCategory(cat) {
  currentCategory = cat;
  syncCategoryTabs(cat);
  renderProducts();
  document.getElementById('collections').scrollIntoView({ behavior: 'smooth' });
}

// Quick Add hero featured product
function quickAddHeroProduct() {
  addToCart('pomi-legend');
}

// ==================== CART MANAGEMENT ====================
function addToCart(productId, selectedSize = null) {
  const product = productsData.find(p => p.id === productId);
  if (!product) return;

  const size = selectedSize || product.sizes?.[0]?.size || '50ml';
  const sizeObj = product.sizes?.find(s => s.size === size);
  const price = sizeObj ? sizeObj.price : product.price;

  const cartItemId = `${product.id}_${size}`;
  const existingIndex = cart.findIndex(item => item.cartItemId === cartItemId);

  if (existingIndex > -1) {
    cart[existingIndex].qty += 1;
  } else {
    cart.push({
      cartItemId,
      id: product.id,
      name: product.name,
      size: size,
      price: price,
      image: product.image,
      concentration: product.concentration,
      qty: 1
    });
  }

  saveCart();
  updateCartUI();
  showToast(`Added "${product.name}" (${size}) to your bag!`);
  openCart();
}

function updateCartQty(cartItemId, delta) {
  const index = cart.findIndex(item => item.cartItemId === cartItemId);
  if (index === -1) return;

  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }

  saveCart();
  updateCartUI();
}

function removeCartItem(cartItemId) {
  cart = cart.filter(item => item.cartItemId !== cartItemId);
  saveCart();
  updateCartUI();
  showToast('Item removed from your bag');
}

function saveCart() {
  localStorage.setItem('aura_cart', JSON.stringify(cart));
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  cartCountBadge.textContent = totalItems;
  cartDrawerCount.textContent = totalItems;
  navCartSubtotal.textContent = `Rs. ${subtotal.toLocaleString()}`;
  cartSubtotalText.textContent = `Rs. ${subtotal.toLocaleString()}`;

  // Shipping calculation
  let shippingFee = STANDARD_SHIPPING_FEE;
  if (subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0) {
    shippingFee = 0;
  }

  // Free shipping progress bar
  const neededForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  if (subtotal === 0) {
    shippingProgressFill.style.width = '0%';
    document.getElementById('shippingNotice').innerHTML = `Add <strong>Rs. ${FREE_SHIPPING_THRESHOLD.toLocaleString()}</strong> for <strong>FREE Delivery!</strong>`;
  } else if (neededForFree > 0) {
    const progressPercent = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
    shippingProgressFill.style.width = `${progressPercent}%`;
    document.getElementById('shippingNotice').innerHTML = `Add <strong>Rs. ${neededForFree.toLocaleString()}</strong> more for <strong>FREE Express Delivery!</strong>`;
  } else {
    shippingProgressFill.style.width = '100%';
    document.getElementById('shippingNotice').innerHTML = `🎉 <strong>Congratulations!</strong> You qualify for <strong>FREE Express Delivery!</strong>`;
  }

  // Discount calculation
  let discountAmount = 0;
  if (activeCoupon) {
    if (activeCoupon.type === 'percent') {
      discountAmount = Math.round((subtotal * activeCoupon.value) / 100);
    } else if (activeCoupon.type === 'shipping') {
      shippingFee = 0;
      discountAmount = STANDARD_SHIPPING_FEE;
    }
    discountLine.style.display = 'flex';
    activeCouponLabel.textContent = activeCoupon.code;
    discountAmountText.textContent = `- Rs. ${discountAmount.toLocaleString()}`;
  } else {
    discountLine.style.display = 'none';
  }

  cartShippingText.textContent = shippingFee === 0 ? 'FREE' : `Rs. ${shippingFee.toLocaleString()}`;
  const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee);
  cartTotalText.textContent = `Rs. ${grandTotal.toLocaleString()}`;

  // Render items
  if (cart.length === 0) {
    cartItemsList.innerHTML = `
      <div class="empty-cart-view">
        <i class="fa-solid fa-spray-can-sparkles empty-icon"></i>
        <h4>Your bag is currently empty</h4>
        <p>Explore our private reserve perfumes and find your signature scent.</p>
        <button class="btn btn-primary" onclick="closeCart(); location.href='#collections';">
          Discover Fragrances
        </button>
      </div>
    `;
    document.getElementById('cartFooter').style.display = 'none';
  } else {
    document.getElementById('cartFooter').style.display = 'block';
    cartItemsList.innerHTML = cart.map(item => `
      <div class="cart-item-row">
        <img src="${item.image}" alt="${item.name}" class="cart-item-thumb">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <div class="cart-item-size">${item.concentration || 'Extrait'} • ${item.size}</div>
          <div class="cart-item-price">Rs. ${(item.price * item.qty).toLocaleString()}</div>
          <div class="qty-control">
            <button class="qty-btn" onclick="updateCartQty('${item.cartItemId}', -1)">-</button>
            <span class="qty-number">${item.qty}</span>
            <button class="qty-btn" onclick="updateCartQty('${item.cartItemId}', 1)">+</button>
          </div>
        </div>
        <button class="cart-remove-btn" onclick="removeCartItem('${item.cartItemId}')" title="Remove item">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join('');
  }
  populateInlineOrderSelect();
  if (checkoutModalOverlay && checkoutModalOverlay.classList.contains('active')) {
    renderCheckoutSummary();
  }
}

function openCart() {
  cartDrawer.classList.add('active');
  cartOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartDrawer.classList.remove('active');
  cartOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Coupon Handling
async function handleApplyCoupon() {
  const code = document.getElementById('couponCodeInput').value.trim();
  const statusEl = document.getElementById('couponStatus');
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (!code) {
    statusEl.className = 'coupon-status error';
    statusEl.textContent = 'Please enter a coupon code';
    return;
  }

  try {
    const res = await fetch('/api/coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal })
    });
    const data = await res.json();

    if (data.success) {
      activeCoupon = {
        code: data.code,
        value: 10,
        type: 'percent',
        description: data.description
      };
      statusEl.className = 'coupon-status success';
      statusEl.textContent = `Applied: ${data.description}`;
      updateCartUI();
    } else {
      statusEl.className = 'coupon-status error';
      statusEl.textContent = data.message || 'Invalid coupon';
    }
  } catch (err) {
    // Fallback client validation
    if (code.toUpperCase() === 'LUXURY10') {
      activeCoupon = { code: 'LUXURY10', value: 10, type: 'percent', description: '10% Off' };
      statusEl.className = 'coupon-status success';
      statusEl.textContent = 'Coupon applied: 10% Off!';
      updateCartUI();
    } else {
      statusEl.className = 'coupon-status error';
      statusEl.textContent = 'Invalid promo code. Try LUXURY10';
    }
  }
}

// ==================== WISHLIST MANAGEMENT ====================
function toggleWishlist(productId) {
  const index = wishlist.indexOf(productId);
  if (index > -1) {
    wishlist.splice(index, 1);
    showToast('Removed from wishlist');
  } else {
    wishlist.push(productId);
    showToast('Saved to your wishlist ❤️');
  }
  localStorage.setItem('aura_wishlist', JSON.stringify(wishlist));
  updateWishlistUI();
  renderProducts();
}

function updateWishlistUI() {
  wishlistCountBadge.textContent = wishlist.length;
  wishlistDrawerCount.textContent = wishlist.length;

  if (wishlist.length === 0) {
    wishlistItemsList.innerHTML = `
      <div class="empty-cart-view">
        <i class="fa-regular fa-heart empty-icon"></i>
        <h4>No wishlist items yet</h4>
        <p>Click the heart icon on any perfume to save it here.</p>
      </div>
    `;
    return;
  }

  const wishlistedProducts = productsData.filter(p => wishlist.includes(p.id));
  wishlistItemsList.innerHTML = wishlistedProducts.map(p => `
    <div class="cart-item-row">
      <img src="${p.image}" alt="${p.name}" class="cart-item-thumb">
      <div class="cart-item-info">
        <h4>${p.name}</h4>
        <div class="cart-item-size">${p.concentration} • ${p.longevity}</div>
        <div class="cart-item-price">Rs. ${p.price.toLocaleString()}</div>
        <button class="btn btn-sm btn-primary" style="margin-top: 0.4rem;" onclick="addToCart('${p.id}'); closeWishlist();">
          Move to Bag
        </button>
      </div>
      <button class="cart-remove-btn" onclick="toggleWishlist('${p.id}')" title="Remove">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');
}

function openWishlist() {
  wishlistDrawer.classList.add('active');
  wishlistOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeWishlist() {
  wishlistDrawer.classList.remove('active');
  wishlistOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// ==================== PRODUCT MODAL (QUICK VIEW) ====================
let modalSelectedSize = null;

function openProductModal(productId) {
  const p = productsData.find(item => item.id === productId);
  if (!p) return;

  modalSelectedSize = p.sizes?.[0] || { size: '50ml', price: p.price };

  const topNotes = p.notes?.top ? p.notes.top.join(', ') : 'Calabrian Citrus, Saffron';
  const heartNotes = p.notes?.heart ? p.notes.heart.join(', ') : 'Damask Rose, Incense, Cedar';
  const baseNotes = p.notes?.base ? p.notes.base.join(', ') : 'Smoked Amber, Oud, Bourbon Vanilla';

  productModalContent.innerHTML = `
    <div class="product-modal-grid">
      <div class="modal-img-col">
        <img src="${p.image}" alt="${p.name}">
      </div>

      <div class="modal-details-col">
        <div class="modal-cat-tag">${p.category} • ${p.concentration}</div>
        <h2 class="modal-product-title">${p.name}</h2>
        
        <div class="modal-rating-row">
          <span class="stars">★★★★★</span>
          <span>${p.rating} / 5.0 (${p.reviewsCount || 120} verified reviews)</span>
        </div>

        <p class="modal-desc-text">${p.description}</p>

        <!-- Scent Pyramid -->
        <div class="notes-pyramid">
          <div class="pyramid-level">
            <span class="level-name">Top Notes:</span>
            <span class="level-items">${topNotes}</span>
          </div>
          <div class="pyramid-level">
            <span class="level-name">Heart Notes:</span>
            <span class="level-items">${heartNotes}</span>
          </div>
          <div class="pyramid-level">
            <span class="level-name">Base Notes:</span>
            <span class="level-items">${baseNotes}</span>
          </div>
        </div>

        <!-- Size options -->
        <div class="size-selector-title">Select Flacon Size:</div>
        <div class="size-options">
          ${(p.sizes || [{ size: '50ml', price: p.price }]).map((s, idx) => `
            <button class="size-pill ${idx === 0 ? 'selected' : ''}" 
                    onclick="selectModalSize('${p.id}', '${s.size}', ${s.price}, this)">
              ${s.size}
            </button>
          `).join('')}
        </div>

        <div class="modal-price-row">
          <span class="modal-current-price" id="modalPriceDisplay">Rs. ${modalSelectedSize.price.toLocaleString()}</span>
          ${p.originalPrice ? `<span class="modal-old-price">Rs. ${(p.originalPrice).toLocaleString()}</span>` : ''}
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary" onclick="addToCart('${p.id}', modalSelectedSize.size); closeProductModal();">
            <i class="fa-solid fa-bag-shopping"></i> Add To Bag
          </button>
          <button class="btn btn-whatsapp" onclick="orderProductWhatsApp('${p.id}', WHATSAPP_PHONE)">
            <i class="fa-brands fa-whatsapp"></i> WhatsApp (0327-6018810)
          </button>
          <button class="btn btn-whatsapp" style="background:#075e54;" onclick="orderProductWhatsApp('${p.id}', WHATSAPP_PHONE_2)">
            <i class="fa-brands fa-whatsapp"></i> WhatsApp (0301-7825827)
          </button>
          <button class="btn btn-outline" onclick="orderProductEmail('${p.id}')">
            <i class="fa-solid fa-envelope"></i> Order via Gmail
          </button>
        </div>
      </div>
    </div>
  `;

  productModalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function orderProductWhatsApp(productId, phone) {
  const p = productsData.find(item => item.id === productId);
  if (!p) return;
  const size = modalSelectedSize?.size || '50ml';
  const price = modalSelectedSize?.price || p.price;
  const msg = `Assalam o Alaikum Hafiz Muhammad Ahmad,%0A%0AI want to order from Pomi Perfumes:%0A*Product:* ${encodeURIComponent(p.name)}%0A*Size:* ${encodeURIComponent(size)}%0A*Price:* Rs. ${price.toLocaleString()}%0A%0APlease share delivery details.`;
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}

function orderProductEmail(productId) {
  const p = productsData.find(item => item.id === productId);
  if (!p) return;
  const size = modalSelectedSize?.size || '50ml';
  const price = modalSelectedSize?.price || p.price;
  const subject = encodeURIComponent(`Order Request: ${p.name} (${size}) - Pomi Perfumes`);
  const body = encodeURIComponent(`Assalam o Alaikum Hafiz Muhammad Ahmad,\n\nI want to order the following perfume:\nProduct: ${p.name}\nSize: ${size}\nPrice: Rs. ${price.toLocaleString()}\n\nMy Name:\nPhone:\nDelivery Address:\n\nPlease confirm my order.`);
  window.location.href = `mailto:${STORE_EMAIL}?subject=${subject}&body=${body}`;
}

function selectModalSize(productId, size, price, element) {
  modalSelectedSize = { size, price };
  const container = element.parentElement;
  container.querySelectorAll('.size-pill').forEach(btn => btn.classList.remove('selected'));
  element.classList.add('selected');
  document.getElementById('modalPriceDisplay').textContent = `Rs. ${price.toLocaleString()}`;
}

function closeProductModal() {
  productModalOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// ==================== CHECKOUT FLOW ====================
function populateCheckoutProductSelect() {
  const select = document.getElementById('checkoutProductSelect');
  if (!select) return;

  select.innerHTML = productsData.length
    ? productsData.map(p => {
        const defaultSizeObj = p.sizes && p.sizes.length ? p.sizes[0] : null;
        const size = defaultSizeObj ? defaultSizeObj.size : '50ml';
        const price = defaultSizeObj ? defaultSizeObj.price : p.price;
        return `<option value="${p.id}">${p.name} (${size}) - Rs. ${price.toLocaleString()}</option>`;
      }).join('')
    : '<option value="">No fragrances available</option>';
}

function addProductFromCheckoutPicker() {
  const select = document.getElementById('checkoutProductSelect');
  if (!select || !select.value) return;

  const prod = productsData.find(p => p.id === select.value);
  if (!prod) return;

  const defaultSizeObj = prod.sizes && prod.sizes.length ? prod.sizes[0] : null;
  const size = defaultSizeObj ? defaultSizeObj.size : '50ml';
  const price = defaultSizeObj ? defaultSizeObj.price : prod.price;
  const cartItemId = `${prod.id}_${size}`;

  const existing = cart.find(c => c.cartItemId === cartItemId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      cartItemId,
      id: prod.id,
      name: prod.name,
      image: prod.image,
      concentration: prod.concentration || 'Extrait',
      size,
      price,
      qty: 1
    });
  }

  saveCart();
  updateCartUI();
  renderCheckoutSummary();
  showToast(`Added ${prod.name} (${size}) to your order.`);
}

function renderCheckoutSummary() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let shippingFee = subtotal === 0 ? 0 : (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE);
  let discountAmount = 0;

  if (subtotal > 0 && activeCoupon) {
    if (activeCoupon.type === 'percent') {
      discountAmount = Math.round((subtotal * activeCoupon.value) / 100);
    } else if (activeCoupon.type === 'shipping') {
      shippingFee = 0;
      discountAmount = STANDARD_SHIPPING_FEE;
    }
    checkoutDiscountLine.style.display = 'flex';
    checkoutDiscount.textContent = `- Rs. ${discountAmount.toLocaleString()}`;
  } else {
    checkoutDiscountLine.style.display = 'none';
  }

  const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee);

  checkoutSubtotal.textContent = `Rs. ${subtotal.toLocaleString()}`;
  checkoutShipping.textContent = subtotal === 0 ? 'Rs. 0' : (shippingFee === 0 ? 'FREE' : `Rs. ${shippingFee.toLocaleString()}`);
  checkoutFinalTotal.textContent = `Rs. ${grandTotal.toLocaleString()}`;

  if (cart.length === 0) {
    checkoutItemsList.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-muted); text-align: center; padding: 0.6rem 0;">No product selected. Pick a perfume above and click Add.</p>`;
    return;
  }

  checkoutItemsList.innerHTML = cart.map(item => `
    <div class="checkout-mini-item">
      <div class="checkout-mini-info">
        <span>${item.name} (${item.size})</span>
        <div class="checkout-mini-controls">
          <button type="button" class="checkout-qty-btn" onclick="updateCartQty('${item.cartItemId}', -1)" title="Decrease quantity">-</button>
          <span>${item.qty}</span>
          <button type="button" class="checkout-qty-btn" onclick="updateCartQty('${item.cartItemId}', 1)" title="Increase quantity">+</button>
          <button type="button" class="checkout-remove-btn" onclick="removeCartItem('${item.cartItemId}')" title="Remove product">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
      <strong>Rs. ${(item.price * item.qty).toLocaleString()}</strong>
    </div>
  `).join('');
}

function openCheckout() {
  populateCheckoutProductSelect();
  renderCheckoutSummary();
  checkoutModalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  checkoutModalOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

function buildWhatsAppOrderUrl(order, phone = WHATSAPP_PHONE) {
  const c = order.customer || {};
  const paymentLabel = order.paymentMethod === 'cod'
    ? 'Cash on Delivery (COD)'
    : (order.paymentMethod === 'online' ? 'Bank Transfer / JazzCash / EasyPaisa' : order.paymentMethod || 'COD');

  const lines = [
    'Assalam o Alaikum Pomi Perfumes,',
    '',
    `I have placed Order *#${order.orderId}* on your website:`,
    '',
    `*Customer:* ${c.name || ''}`,
    `*Phone:* ${c.phone || ''}`
  ];

  if (c.email) lines.push(`*Email:* ${c.email}`);
  if (c.city) lines.push(`*City:* ${c.city}`);
  if (c.address) lines.push(`*Address:* ${c.address}`);
  if (c.zip) lines.push(`*ZIP / Postal Code:* ${c.zip}`);
  if (c.country) lines.push(`*Country:* ${c.country}`);
  if (c.notes) lines.push(`*Notes:* ${c.notes}`);

  lines.push('', '*Selected Products:*');
  (order.items || []).forEach(i => {
    lines.push(`• ${i.name} (${i.size}) x${i.qty} = Rs. ${(i.price * i.qty).toLocaleString()}`);
  });

  lines.push(
    '',
    `*Net Payable:* Rs. ${(order.pricing?.total || 0).toLocaleString()} (${paymentLabel})`,
    '',
    'Please confirm priority dispatch!'
  );

  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
}

function openOrderInWhatsApp(order, preOpenedWin) {
  const waUrl = buildWhatsAppOrderUrl(order, WHATSAPP_PHONE);
  if (preOpenedWin && !preOpenedWin.closed) {
    preOpenedWin.location.href = waUrl;
  } else {
    window.open(waUrl, '_blank');
  }
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  if (cart.length === 0) {
    showToast('Please select or add at least one perfume first.');
    return;
  }

  const submitBtn = document.getElementById('submitOrderBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Placing Order...`;

  // Pre-open tab synchronously on user submit so browser popup blockers allow redirecting to WhatsApp
  const waWin = window.open('about:blank', '_blank');

  const customer = {
    name: document.getElementById('custName').value.trim(),
    phone: document.getElementById('custPhone').value.trim(),
    email: document.getElementById('custEmail').value.trim(),
    city: document.getElementById('custCity').value.trim(),
    address: document.getElementById('custAddress').value.trim(),
    notes: document.getElementById('custNotes').value.trim()
  };

  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  let discount = 0;

  if (activeCoupon) {
    if (activeCoupon.type === 'percent') {
      discount = Math.round((subtotal * activeCoupon.value) / 100);
    } else if (activeCoupon.type === 'shipping') {
      shippingFee = 0;
      discount = STANDARD_SHIPPING_FEE;
    }
  }

  const total = Math.max(0, subtotal - discount + shippingFee);

  const orderPayload = {
    customer,
    items: cart,
    paymentMethod,
    couponCode: activeCoupon ? activeCoupon.code : null,
    pricing: { subtotal, discount, shippingFee, total }
  };

  let finalOrder = null;
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
    const data = await res.json();

    if (data.success) {
      finalOrder = data.order;
    } else {
      if (waWin && !waWin.closed) waWin.close();
      showToast(data.message || 'Error creating order');
      return;
    }
  } catch (err) {
    // Simulated offline success
    finalOrder = {
      orderId: 'ALX-' + Math.floor(100000 + Math.random() * 900000),
      trackingNumber: 'TRK-' + Date.now().toString().slice(-8),
      customer,
      items: cart,
      paymentMethod,
      pricing: { subtotal, discount, shippingFee, total }
    };
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-brands fa-whatsapp"></i> <span>Confirm & Send Order on WhatsApp</span>`;
  }

  if (finalOrder) {
    openOrderInWhatsApp(finalOrder, waWin);
    showOrderSuccess(finalOrder);
    cart = [];
    activeCoupon = null;
    saveCart();
    updateCartUI();
    checkoutForm.reset();
    closeCheckout();
  }
}

function showOrderSuccess(order) {
  document.getElementById('successOrderId').textContent = order.orderId;
  document.getElementById('successTrackingId').textContent = order.trackingNumber;
  document.getElementById('successCustomerName').textContent = `${order.customer.name} (${order.customer.city})`;
  document.getElementById('successTotalAmount').textContent = `Rs. ${order.pricing.total.toLocaleString()}`;
  document.getElementById('successPaymentMethod').textContent = order.paymentMethod === 'cod'
    ? 'Cash on Delivery (COD)'
    : (order.paymentMethod === 'online' ? 'Bank Transfer / JazzCash / EasyPaisa' : order.paymentMethod);

  document.getElementById('successWhatsAppConfirmBtn').onclick = () => {
    window.open(buildWhatsAppOrderUrl(order, WHATSAPP_PHONE), '_blank');
  };

  const btn2 = document.getElementById('successWhatsAppConfirmBtn2');
  if (btn2) {
    btn2.onclick = () => {
      window.open(buildWhatsAppOrderUrl(order, WHATSAPP_PHONE_2), '_blank');
    };
  }

  orderSuccessModal.classList.add('active');
}

function closeSuccessModal() {
  orderSuccessModal.classList.remove('active');
}

// Order bag directly via WhatsApp
function orderCartViaWhatsApp() {
  if (cart.length === 0) {
    showToast('Your bag is empty');
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const itemsText = cart.map(i => `• ${i.name} (${i.size}) x${i.qty} = Rs. ${(i.price * i.qty).toLocaleString()}`).join('%0A');
  const waMsg = `Hello Pomi Perfumes,%0A%0AI want to order the following perfumes:%0A%0A${itemsText}%0A%0A*Subtotal:* Rs. ${subtotal.toLocaleString()}%0A%0APlease send me payment & delivery details.`;

  window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${waMsg}`, '_blank');
}

// ==================== STORE ORDERS LEDGER (ADMIN VIEW) ====================
async function openRecentOrdersModal() {
  const modal = document.getElementById('recentOrdersModal');
  const wrapper = document.getElementById('ordersTableWrapper');
  wrapper.innerHTML = `<p style="padding: 1rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Fetching recent orders...</p>`;
  modal.classList.add('active');

  try {
    const res = await fetch('/api/orders');
    if (res.status === 401) {
      wrapper.innerHTML = `
        <div style="padding: 1.5rem; text-align: center;">
          <p style="color: var(--text-muted); margin-bottom: 1rem;">
            <i class="fa-solid fa-lock text-gold"></i> Sirf Store Admin login karke orders dekh sakte hain.
          </p>
          <a href="/dashboard" class="btn btn-primary btn-sm" style="text-decoration:none;">
            <i class="fa-solid fa-right-to-bracket"></i> Admin Login / Dashboard
          </a>
        </div>
      `;
      return;
    }
    const json = await res.json();
    if (json.success && json.orders.length > 0) {
      wrapper.innerHTML = `
        <table class="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>City</th>
              <th>Items</th>
              <th>Total</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            ${json.orders.slice(0, 20).map(o => `
              <tr>
                <td><strong class="text-gold">${o.orderId}</strong></td>
                <td>${o.customer?.name || 'Guest'}<br><small style="color:var(--text-muted);">${o.customer?.phone || ''}</small></td>
                <td>${o.customer?.city || '-'}</td>
                <td>${(o.items || []).map(i => `${i.name} x${i.qty}`).join(', ') || '1 item'}</td>
                <td><strong>Rs. ${(o.pricing?.total || 0).toLocaleString()}</strong></td>
                <td><span style="font-size:0.75rem; text-transform:uppercase;">${o.status || o.paymentMethod || 'cod'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      wrapper.innerHTML = `<p style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No orders placed yet in this session.</p>`;
    }
  } catch (err) {
    wrapper.innerHTML = `<p style="color: var(--accent-red);">Unable to retrieve orders ledger.</p>`;
  }
}

function closeRecentOrdersModal() {
  document.getElementById('recentOrdersModal').classList.remove('active');
}

// Helper info modals
function showShippingInfo() {
  showToast('🚚 Delivery takes 2-3 business days via TCS & Leopard Express nationwide with Cash on Delivery.');
}

function showReturnsInfo() {
  showToast('🔄 7-day hassle-free exchange policy if the original bottle seal is unopened.');
}

function showTesterInfo() {
  showToast('🎁 Every order includes a complimentary 2ml tester vial to try first before opening the main flacon!');
}

// ==================== INLINE ORDER FORM ====================
function populateInlineOrderSelect() {
  const select = document.getElementById('inlineProductSelect');
  const qtyInput = document.getElementById('inlineProductQty');
  if (!select) return;

  const previousVal = select.value;
  const options = [];

  productsData.forEach(p => {
    const defaultSizeObj = p.sizes && p.sizes.length ? p.sizes[0] : null;
    const size = defaultSizeObj ? defaultSizeObj.size : '50ml';
    const price = defaultSizeObj ? defaultSizeObj.price : p.price;
    options.push(`<option value="${p.id}">${p.name} - Rs. ${price.toLocaleString()} (${size})</option>`);
  });

  if (cart.length > 1) {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const namesSummary = cart.map(item => `${item.name} x${item.qty}`).join(', ');
    options.push(
      `<option value="__CART__">All Selected Products (${namesSummary}) - Rs. ${subtotal.toLocaleString()}</option>`
    );
  }

  select.innerHTML = options.length
    ? options.join('')
    : '<option value="">No fragrances available</option>';

  if (previousVal && previousVal !== '__CART__' && Array.from(select.options).some(opt => opt.value === previousVal)) {
    select.value = previousVal;
  } else if (cart.length === 1 && Array.from(select.options).some(opt => opt.value === cart[0].id)) {
    select.value = cart[0].id;
    if (qtyInput) qtyInput.value = cart[0].qty || 1;
  } else if (cart.length > 1 && previousVal === '__CART__') {
    select.value = '__CART__';
  }
  syncInlineQtyState();
}

function renderInlineProductPreview() {
  const preview = document.getElementById('inlineProductPreview');
  const select = document.getElementById('inlineProductSelect');
  const qtyInput = document.getElementById('inlineProductQty');
  if (!preview || !select) return;

  const val = select.value;
  if (val === '__CART__' && cart.length > 0) {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
    const firstImg = cart[0].image || '';
    const summaryNames = cart.map(i => `${i.name} (${i.size}) x${i.qty}`).join(' • ');
    preview.innerHTML = `
      <div class="inline-preview-left">
        ${firstImg ? `<img src="${firstImg}" alt="Selected Perfume" class="inline-preview-thumb">` : ''}
        <div class="inline-preview-info">
          <h4>Selected Perfumes (${cart.length})</h4>
          <span>${summaryNames}</span>
        </div>
      </div>
      <div class="inline-preview-price">
        <strong>Rs. ${(subtotal + shipping).toLocaleString()}</strong>
        <span>${shipping === 0 ? 'Free Delivery' : `Incl. Rs. ${shipping} Delivery`}</span>
      </div>
    `;
    return;
  }

  const prod = productsData.find(p => p.id === val) || productsData[0];
  if (!prod) {
    preview.innerHTML = '';
    return;
  }

  const defaultSizeObj = prod.sizes && prod.sizes.length ? prod.sizes[0] : null;
  const size = defaultSizeObj ? defaultSizeObj.size : '50ml';
  const unitPrice = defaultSizeObj ? defaultSizeObj.price : prod.price;
  const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : '1', 10) || 1);
  const subtotal = unitPrice * qty;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;

  preview.innerHTML = `
    <div class="inline-preview-left">
      <img src="${prod.image}" alt="${prod.name}" class="inline-preview-thumb">
      <div class="inline-preview-info">
        <h4>${prod.name}</h4>
        <span>${prod.concentration || 'Extrait de Parfum'} • ${size} • Qty: ${qty}</span>
      </div>
    </div>
    <div class="inline-preview-price">
      <strong>Rs. ${(subtotal + shipping).toLocaleString()}</strong>
      <span>Rs. ${unitPrice.toLocaleString()} x ${qty} ${shipping === 0 ? '(Free Delivery)' : `+ Rs. ${shipping} Delivery`}</span>
    </div>
  `;
}

function syncInlineQtyState() {
  const select = document.getElementById('inlineProductSelect');
  const qtyInput = document.getElementById('inlineProductQty');
  if (!select || !qtyInput) return;

  if (select.value === '__CART__') {
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    qtyInput.value = totalQty || 1;
    qtyInput.disabled = true;
  } else {
    qtyInput.disabled = false;
    if (!qtyInput.value || Number(qtyInput.value) < 1) qtyInput.value = 1;
  }
  renderInlineProductPreview();
}

async function handleInlineOrderSubmit(e) {
  e.preventDefault();

  const select = document.getElementById('inlineProductSelect');
  const qtyInput = document.getElementById('inlineProductQty');
  const selectVal = select ? select.value : '';
  const usingCart = selectVal === '__CART__' && cart.length > 0;
  const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : '1', 10) || 1);

  let orderItems = [];
  if (usingCart) {
    orderItems = [...cart];
  } else {
    const prod = productsData.find(p => p.id === selectVal) || productsData[0];
    if (!prod) {
      showToast('Please select a fragrance to place an order.');
      return;
    }
    const defaultSizeObj = prod.sizes && prod.sizes.length ? prod.sizes[0] : null;
    orderItems = [{
      id: prod.id,
      name: prod.name,
      size: defaultSizeObj ? defaultSizeObj.size : '50ml',
      price: defaultSizeObj ? defaultSizeObj.price : prod.price,
      qty,
      image: prod.image,
      concentration: prod.concentration || 'Extrait'
    }];
  }

  const submitBtn = document.getElementById('inlinePlaceOrderBtn');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Placing Order...`;
  }

  // Pre-open tab synchronously on user submit so browser popup blockers allow redirecting to WhatsApp
  const waWin = window.open('about:blank', '_blank');

  const customer = {
    name: document.getElementById('inlineFullName').value.trim(),
    phone: document.getElementById('inlinePhone').value.trim(),
    email: document.getElementById('inlineEmail').value.trim(),
    address: document.getElementById('inlineAddress').value.trim(),
    city: document.getElementById('inlineCity').value.trim(),
    zip: document.getElementById('inlineZip').value.trim(),
    country: document.getElementById('inlineCountry').value.trim()
  };

  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  let discount = 0;

  if (usingCart && activeCoupon) {
    if (activeCoupon.type === 'percent') {
      discount = Math.round((subtotal * activeCoupon.value) / 100);
    } else if (activeCoupon.type === 'shipping') {
      shippingFee = 0;
      discount = STANDARD_SHIPPING_FEE;
    }
  }

  const total = Math.max(0, subtotal - discount + shippingFee);

  const orderPayload = {
    customer,
    items: orderItems,
    paymentMethod: 'Cash on Delivery (COD)',
    couponCode: usingCart && activeCoupon ? activeCoupon.code : null,
    pricing: { subtotal, discount, shippingFee, total }
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
    const data = await res.json();

    if (data.success) {
      openOrderInWhatsApp(data.order, waWin);
      if (usingCart) {
        cart = [];
        activeCoupon = null;
        saveCart();
        updateCartUI();
      }
      e.target.reset();
      const countryInput = document.getElementById('inlineCountry');
      if (countryInput) countryInput.value = 'Pakistan';
      if (qtyInput) qtyInput.value = '1';
      populateInlineOrderSelect();
      showToast('Order placed! Opening WhatsApp to send your order details.');
      showOrderSuccess(data.order);
    } else {
      if (waWin && !waWin.closed) waWin.close();
      showToast(data.error || 'Could not place order. Please try again.');
    }
  } catch (err) {
    if (waWin && !waWin.closed) waWin.close();
    console.error('Inline order submission error:', err);
    showToast('Network error while placing order. Please try again.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid fa-sparkles"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
