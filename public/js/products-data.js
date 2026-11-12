const PRODUCTS = [
  {
    id: "pomi-legend",
    name: "LEGEND FOR MEN",
    tagline: "Bold. Confident. Timeless. A fragrance that commands attention",
    category: "men",
    badge: "Bestseller",
    concentration: "Extrait de Parfum",
    gender: "Men",
    rating: 5.0,
    reviewsCount: 196,
    price: 3099,
    originalPrice: 4200,
    image: "images/legend-for-men.jpg",
    description: "BOLD. CONFIDENT. TIMELESS. Crafted by Pomi Perfumes. A fragrance that commands attention and leaves a lasting impression. Be a Legend.",
    notes: {
      top: ["Calabrian Bergamot", "Pink Pepper", "Cardamom"],
      heart: ["Aromatic Lavender", "Cedarwood", "Elemi Resin"],
      base: ["Smoky Leather", "Ambergris", "Warm Woods"]
    },
    sizes: [
      { size: "50ml", price: 3099 },
      { size: "100ml", price: 4999 }
    ],
    longevity: "16+ Hours",
    sillage: "Commanding",
    inStock: true
  },
  {
    id: "pomi-dunhill-desire",
    name: "DUNHILL DESIRE FOR MEN",
    tagline: "Bold. Confident. Irresistible. Desire it. Live it. Own the moment",
    category: "men",
    badge: "Hot Trend",
    concentration: "Extrait de Parfum",
    gender: "Men",
    rating: 4.9,
    reviewsCount: 178,
    price: 2799,
    originalPrice: 3800,
    image: "images/dunhill-desire-for-men.jpg",
    description: "BOLD. CONFIDENT. IRRESISTIBLE. An iconic fragrance that commands attention and leaves a lasting impression. Desire it. Live it. Own the moment.",
    notes: {
      top: ["Red Apple", "Calabrian Bergamot", "Lemon"],
      heart: ["Teak Wood", "Rose", "Patchouli"],
      base: ["Madagascar Vanilla", "Musk", "Warm Amber"]
    },
    sizes: [
      { size: "50ml", price: 2799 },
      { size: "100ml", price: 4499 }
    ],
    longevity: "14+ Hours",
    sillage: "Irresistible",
    inStock: true
  },
  {
    id: "pomi-white-oud",
    name: "WHITE OUD",
    tagline: "A Timeless Essence of Purity and Depth",
    category: "oud",
    badge: "Most Loved",
    concentration: "Extrait de Parfum",
    gender: "Unisex / Regal",
    rating: 5.0,
    reviewsCount: 245,
    price: 3199,
    originalPrice: 4500,
    image: "images/white-oud.jpg",
    description: "DISCOVER ELEGANCE. A Timeless Essence of Purity and Depth. Premium quality White Oud crafted by Pomi Perfumes. Rich, refined, and formulated for enduring celestial projection.",
    notes: {
      top: ["Taif Rose", "White Saffron", "Bergamot"],
      heart: ["Cambodian White Oud", "Incense", "White Jasmine"],
      base: ["Crystalline Amber", "White Musk", "Mysore Sandalwood"]
    },
    sizes: [
      { size: "50ml", price: 3199 },
      { size: "100ml", price: 4999 }
    ],
    longevity: "16+ Hours",
    sillage: "Rich & Refined",
    inStock: true
  },
  {
    id: "pomi-david-beckham",
    name: "DAVID BECKHAM",
    tagline: "A signature fragrance embodying timeless elegance and masculine sophistication",
    category: "men",
    badge: "Iconic",
    concentration: "Extrait de Parfum",
    gender: "Men",
    rating: 4.9,
    reviewsCount: 189,
    price: 2699,
    originalPrice: 3600,
    image: "images/david-beckham.jpg",
    description: "A signature fragrance embodying timeless elegance and masculine sophistication. Leave a lasting, unforgettable impression. Crafted by Pomi Perfumes.",
    notes: {
      top: ["Grapefruit", "Cardamom", "Crisp Bergamot"],
      heart: ["Nutmeg", "Star Anise", "Violet"],
      base: ["Sandalwood", "Warm Amber", "Patchouli"]
    },
    sizes: [
      { size: "50ml", price: 2699 },
      { size: "100ml", price: 4299 }
    ],
    longevity: "14+ Hours",
    sillage: "Sophisticated",
    inStock: true
  },
  {
    id: "pomi-janan",
    name: "JANAN",
    tagline: "A fragrance that whispers timeless elegance. Leave an unforgettable impression",
    category: "men",
    badge: "Summer Signature",
    concentration: "Extrait de Parfum",
    gender: "Men",
    rating: 4.9,
    reviewsCount: 210,
    price: 3099,
    originalPrice: 4200,
    image: "images/janan.jpg",
    description: "LEAVE YOUR MARK. A fragrance that whispers timeless elegance. Leave an unforgettable impression. Crafted by Pomi Perfumes with fresh bergamot, marine notes, and noble woods.",
    notes: {
      top: ["Calabrian Bergamot", "Mandarin", "Red Apple"],
      heart: ["Fresh Lavender", "Marine Accord", "Cardamom"],
      base: ["Oakmoss", "Sensual Amber", "Patchouli"]
    },
    sizes: [
      { size: "50ml", price: 3099 },
      { size: "100ml", price: 4999 }
    ],
    longevity: "14+ Hours",
    sillage: "Timeless & Fresh",
    inStock: true
  },
  {
    id: "pomi-janan-special",
    name: "JANAN",
    tagline: "A fragrance that whispers timeless elegance. Leave an unforgettable impression",
    category: "men",
    badge: "Special Edition",
    concentration: "Extrait de Parfum",
    gender: "Men",
    rating: 4.9,
    reviewsCount: 195,
    price: 2999,
    originalPrice: 3999,
    image: "images/janan.jpg",
    description: "LEAVE YOUR MARK. A fragrance that whispers timeless elegance. Leave an unforgettable impression. Crafted by Pomi Perfumes with fresh bergamot, marine notes, and noble woods.",
    notes: {
      top: ["Calabrian Bergamot", "Mandarin", "Red Apple"],
      heart: ["Fresh Lavender", "Marine Accord", "Cardamom"],
      base: ["Oakmoss", "Sensual Amber", "Patchouli"]
    },
    sizes: [
      { size: "50ml", price: 2999 },
      { size: "100ml", price: 4799 }
    ],
    longevity: "16+ Hours",
    sillage: "Warm & Enveloping",
    inStock: true
  },
  {
    id: "pomi-romantic-coffee",
    name: "ROMANTIC COFFEE",
    tagline: "A fragrance as enchanting as love itself. Let your presence captivate and linger",
    category: "unisex",
    badge: "Indulge in Romance",
    concentration: "Extrait de Parfum",
    gender: "Unisex",
    rating: 5.0,
    reviewsCount: 182,
    price: 3499,
    originalPrice: 4800,
    image: "images/romantic-coffee.jpg",
    description: "INDULGE IN ROMANCE. A fragrance as enchanting as love itself. Let your presence captivate and linger. Intoxicating dark roasted espresso beans dipped in warm caramel, roasted hazelnuts, and velvety Madagascar vanilla.",
    notes: {
      top: ["Roasted Coffee Bean", "Bitter Almond", "Cardamom"],
      heart: ["Dark Cacao", "Praline", "Tonka Bean"],
      base: ["Bourbon Vanilla", "White Amber", "Cedarwood"]
    },
    sizes: [
      { size: "50ml", price: 3499 },
      { size: "100ml", price: 5499 }
    ],
    longevity: "16+ Hours",
    sillage: "Captivating",
    inStock: true
  },
  {
    id: "pomi-srk-signature",
    name: "SRK SIGNATURE",
    tagline: "A fragrance that commands attention. Own the moment. Be unforgettable",
    category: "unisex",
    badge: "Celebrity Edition",
    concentration: "Extrait de Parfum",
    gender: "Unisex / Star",
    rating: 5.0,
    reviewsCount: 280,
    price: 3199,
    originalPrice: 4500,
    image: "images/srk-signature.jpg",
    description: "LEAVE YOUR MARK. A fragrance that commands attention. Own the moment. Be unforgettable. Crafted by Pomi Perfumes with magnetic woods, warm ambergris, spiced saffron, and rare cashmere notes.",
    notes: {
      top: ["Kashmiri Saffron", "Nutmeg", "Crisp Bergamot"],
      heart: ["Royal Woods", "Cistus Incanus", "Iris"],
      base: ["Ambergris", "Cashmere Wood", "Dark Oud"]
    },
    sizes: [
      { size: "50ml", price: 3199 },
      { size: "100ml", price: 4999 }
    ],
    longevity: "16+ Hours",
    sillage: "Commanding",
    inStock: true
  },
  {
    id: "pomi-legend-royal",
    name: "LEGEND FOR MEN",
    tagline: "Bold. Confident. Timeless. A fragrance that commands attention",
    category: "men",
    badge: "Royal Edition",
    concentration: "Extrait de Parfum",
    gender: "Men",
    rating: 5.0,
    reviewsCount: 152,
    price: 3299,
    originalPrice: 4500,
    image: "images/legend-for-men.jpg",
    description: "BOLD. CONFIDENT. TIMELESS. A fragrance that commands attention and leaves a lasting impression. Be a Legend. Hand-crafted by Pomi Perfumes with crisp spices, noble lavender, and warm amber.",
    notes: {
      top: ["Black Pepper", "Pink Pepper", "Calabrian Bergamot"],
      heart: ["French Lavender", "Elemi Resin", "Geranium"],
      base: ["Smoky Leather", "Vetiver", "Cedarwood"]
    },
    sizes: [
      { size: "50ml", price: 3299 },
      { size: "100ml", price: 5199 }
    ],
    longevity: "16+ Hours",
    sillage: "Commanding",
    inStock: true
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PRODUCTS;
}
