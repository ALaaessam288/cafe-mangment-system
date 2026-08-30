/* ═══════════════════════════════════════════════════════════════
   Cashier menu grouping helpers.

   The database has ~25 real categories, which is far too many tabs for a
   cashier to scan. Instead of changing the data model, we fold the REAL
   categories into a handful of top-level groups at display time. Nothing is
   invented and nothing is lost: any category that doesn't match a known group
   falls into "أخرى", so every product stays reachable in at most 2 clicks.
   ═══════════════════════════════════════════════════════════════ */

export const TOP_SELLERS_ID = 'TOP_SELLERS';

/* Arabic-friendly normalisation so "لات" matches "لاتيه" and "قشطوطه"
   matches "قشطوطة". Also lowercases so English names work. */
export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '') // diacritics + tatweel
    .replace(/[أإآٱ]/g, 'ا') // أ إ آ ٱ -> ا
    .replace(/ة/g, 'ه') // ة -> ه
    .replace(/ى/g, 'ي') // ى -> ي
    .replace(/ؤ/g, 'و') // ؤ -> و
    .replace(/ئ/g, 'ي') // ئ -> ي
    .replace(/\s+/g, ' ')
    .trim();
}

export function isFoodProduct(product) {
  return product?.revenueLine === 'FOOD' || product?.stationCode === 'KITCHEN';
}

export const GROUP_PHOTOS = {
  TOP_SELLERS: '/images/categories/top_sellers.jpg',
  DRINKS: '/images/categories/hot.jpg',
  FOOD: '/images/categories/food.jpg',
  DESSERTS: '/images/categories/desserts.jpg',
  EXTRAS: '/images/categories/snacks.jpg',
  OTHER: '/images/categories/food.jpg',
};

export function getCategoryVisual(name = '') {
  const norm = normalizeText(name);
  if (norm.includes('قهوه') || norm.includes('اسبريسو') || norm.includes('تركي') || norm.includes('فرنساوي') || norm.includes('نسكافيه') || norm.includes('لاتيه') || norm.includes('كابتشينو') || norm.includes('موكا') || norm.includes('امريكانو')) {
    return { icon: '☕', photo: '/images/categories/hot.jpg', color: '#f59e0b', tag: 'قهوة' };
  }
  if (norm.includes('شاي') || norm.includes('ينسون') || norm.includes('اعشاب') || norm.includes('كركديه') || norm.includes('نعناع') || norm.includes('قرفه') || norm.includes('جنزبيل')) {
    return { icon: '🫖', photo: '/images/categories/hot.jpg', color: '#10b981', tag: 'أعشاب' };
  }
  if (norm.includes('سخن') || norm.includes('ساخن') || norm.includes('هوت') || norm.includes('سحلب') || norm.includes('كاكاو')) {
    return { icon: '☕', photo: '/images/categories/hot.jpg', color: '#f97316', tag: 'مشروبات ساخنة' };
  }
  if (norm.includes('ايس') || norm.includes('بارد') || norm.includes('ساقع') || norm.includes('موهيتو') || norm.includes('صودا') || norm.includes('غازي') || norm.includes('مياه') || norm.includes('ريد بول') || norm.includes('كولد')) {
    return { icon: '🧊', photo: '/images/categories/cold.jpg', color: '#38bdf8', tag: 'مشروبات مثلجة' };
  }
  if (norm.includes('عصير') || norm.includes('فريش') || norm.includes('فرابيه') || norm.includes('ميلك') || norm.includes('شيك') || norm.includes('سموزي') || norm.includes('كوكتيل')) {
    return { icon: '🍹', photo: '/images/categories/juice.jpg', color: '#ec4899', tag: 'عصائر وفرابيه' };
  }
  if (norm.includes('وافل') || norm.includes('بان كيك') || norm.includes('بانكيك') || norm.includes('فريسكا')) {
    return { icon: '🧇', photo: '/images/categories/desserts.jpg', color: '#f59e0b', tag: 'وافل وبان كيك' };
  }
  if (norm.includes('قشطوط') || norm.includes('مولتن') || norm.includes('فادج') || norm.includes('طاجن') || norm.includes('كيك') || norm.includes('تشيز') || norm.includes('سينابون') || norm.includes('دونتس')) {
    return { icon: '🍰', photo: '/images/categories/desserts.jpg', color: '#a855f7', tag: 'كيك وحلويات' };
  }
  if (norm.includes('ايس كريم') || norm.includes('جيلاتي') || norm.includes('مثلج')) {
    return { icon: '🍨', photo: '/images/categories/desserts.jpg', color: '#06b6d4', tag: 'آيس كريم' };
  }
  if (norm.includes('ساندوتش') || norm.includes('سوري') || norm.includes('رول') || norm.includes('شاورما') || norm.includes('بانيني')) {
    return { icon: '🥪', photo: '/images/categories/food.jpg', color: '#eab308', tag: 'سندوتشات' };
  }
  if (norm.includes('بيتزا') || norm.includes('فطير')) {
    return { icon: '🍕', photo: '/images/categories/food.jpg', color: '#ef4444', tag: 'بيتزا' };
  }
  if (norm.includes('برجر') || norm.includes('لحم') || norm.includes('فراخ') || norm.includes('وجب')) {
    return { icon: '🍔', photo: '/images/categories/food.jpg', color: '#f97316', tag: 'برجر ووجبات' };
  }
  if (norm.includes('كريب')) {
    return { icon: '🌯', photo: '/images/categories/food.jpg', color: '#84cc16', tag: 'كريب' };
  }
  if (norm.includes('مكرون') || norm.includes('باستا') || norm.includes('نجريسكو')) {
    return { icon: '🍝', photo: '/images/categories/food.jpg', color: '#f43f5e', tag: 'باستا' };
  }
  if (norm.includes('بطاطس') || norm.includes('فرايز') || norm.includes('مقرمش') || norm.includes('مقبلات') || norm.includes('سناكس')) {
    return { icon: '🍟', photo: '/images/categories/snacks.jpg', color: '#eab308', tag: 'مقبلات وسناكس' };
  }
  if (norm.includes('اضاف') || norm.includes('صوص') || norm.includes('نكه') || norm.includes('سيرب') || norm.includes('توبينج')) {
    return { icon: '➕', photo: '/images/categories/snacks.jpg', color: '#64748b', tag: 'إضافات' };
  }
  return { icon: '🍽️', photo: '/images/categories/food.jpg', color: 'var(--accent)', tag: 'عام' };
}

export const GROUP_DEFS = [
  {
    id: 'DRINKS',
    label: 'مشروبات',
    icon: '🥤',
    photo: '/images/categories/hot.jpg',
    keywords: [
      'ساخن', 'اسبريسو', 'سخن', 'قهوه', 'شاي', 'ينسون', 'نسكافيه', 'هوت',
      'ايس', 'غازيه', 'موهيتو', 'بارد', 'ساقع', 'مياه', 'صودا', 'عصير',
      'فرابيه', 'ميلك', 'شيك', 'سموزي', 'كوكتيل', 'اعشاب', 'كركديه',
      'كولد', 'درينك', 'مشروب', 'مشروبات', 'hot', 'cold', 'iced', 'coffee',
      'tea', 'juice', 'drink', 'soda', 'beverage', 'water', 'shake', 'frappe'
    ],
  },
  {
    id: 'FOOD',
    label: 'مأكولات',
    icon: '🍽️',
    photo: '/images/categories/food.jpg',
    keywords: [
      'ساندوتش', 'نجريسكو', 'كريب', 'بيتزا', 'سوري', 'برجر', 'وجب', 'ركن',
      'مقرمشات', 'بطاطس', 'فرايز', 'باستا', 'مكرونه', 'شاورما', 'اكل', 'ماكولات',
      'sandwich', 'negresco', 'crepe', 'pizza', 'burger', 'meal', 'fries',
      'food', 'pasta'
    ],
  },
  {
    id: 'DESSERTS',
    label: 'حلويات',
    icon: '🍰',
    photo: '/images/categories/desserts.jpg',
    keywords: [
      'وافل', 'بان كيك', 'بانكيك', 'قشطوطه', 'قشطوطة', 'مولتن', 'فادج', 'طاجن', 'فريسكا',
      'حلو', 'حلويات', 'كيك', 'ايس كريم', 'تشيز', 'دونتس', 'سينابون', 'جيلاتي',
      'waffle', 'pancake', 'molten', 'fudge', 'fresca', 'dessert', 'cake',
      'tagen', 'qashtota', 'ice cream', 'sweet'
    ],
  },
  {
    id: 'EXTRAS',
    label: 'إضافات',
    icon: '➕',
    photo: '/images/categories/snacks.jpg',
    keywords: ['اضاف', 'extra', 'addition', 'topping', 'صوص', 'سيرب'],
  },
];

const OTHER_GROUP = { id: 'OTHER', label: 'أخرى', icon: '🍽️', photo: '/images/categories/food.jpg', keywords: [] };

function matchGroupByName(name) {
  const normalized = normalizeText(name);
  if (!normalized) return null;
  return GROUP_DEFS.find((g) => g.keywords.some((k) => normalized.includes(normalizeText(k)))) ?? null;
}

/**
 * Folds the real categories into display groups.
 * @returns {Array<{id,label,icon,categories,productCount}>} only non-empty groups.
 */
export function buildMenuGroups(categories = [], products = []) {
  const byCategory = new Map();
  products.forEach((p) => {
    if (!byCategory.has(p.categoryId)) byCategory.set(p.categoryId, []);
    byCategory.get(p.categoryId).push(p);
  });

  const buckets = new Map();
  const ensure = (def) => {
    if (!buckets.has(def.id)) {
      buckets.set(def.id, { id: def.id, label: def.label, icon: def.icon, photo: def.photo, categories: [], productCount: 0 });
    }
    return buckets.get(def.id);
  };

  categories.forEach((cat) => {
    const catProducts = byCategory.get(cat.id) ?? [];
    let def = matchGroupByName(cat.name ?? cat.nameAr ?? cat.nameEn);

    if (!def) {
      const foodCount = catProducts.filter(isFoodProduct).length;
      def = catProducts.length > 0 && foodCount * 2 >= catProducts.length
        ? GROUP_DEFS.find((g) => g.id === 'FOOD')
        : GROUP_DEFS.find((g) => g.id === 'DRINKS') || OTHER_GROUP;
    }

    const bucket = ensure(def);
    bucket.categories.push({
      ...cat,
      displayName: cat.nameAr != null && cat.nameAr.trim() !== '' ? cat.nameAr : (cat.name != null ? cat.name : cat.nameEn),
      productCount: catProducts.length,
      visual: getCategoryVisual(cat.name ?? cat.nameAr ?? cat.nameEn)
    });
    bucket.productCount += catProducts.length;
  });

  const order = [...GROUP_DEFS.map((g) => g.id), OTHER_GROUP.id];
  return order
    .map((id) => buckets.get(id))
    .filter((g) => g && g.productCount > 0);
}

/** Products belonging to a display group (optionally narrowed to one real category). */
export function productsForGroup(products, group, categoryId) {
  if (!group) return products;
  const ids = new Set(group.categories.map((c) => c.id));
  return products.filter(
    (p) => ids.has(p.categoryId) && (categoryId == null || categoryId === 'ALL' || p.categoryId === categoryId)
  );
}

/** Fast, forgiving search over Arabic + English names and the category name. */
export function searchProducts(products, query, categories = []) {
  const q = normalizeText(query);
  if (!q) return products;
  const terms = q.split(' ').filter(Boolean);
  const catNameById = new Map(categories.map((c) => [c.id, normalizeText(c.name ?? c.nameAr ?? c.nameEn)]));

  const scored = [];
  products.forEach((p) => {
    const ar = normalizeText(p.nameAr ?? p.name);
    const en = normalizeText(p.nameEn);
    const cat = catNameById.get(p.categoryId) ?? '';
    const haystack = `${ar} ${en} ${cat}`;
    if (!terms.every((t) => haystack.includes(t))) return;

    // Prefix hits on the product's own name rank above mid-word / category hits.
    let score = 3;
    if (ar.includes(q) || en.includes(q)) score = 2;
    if (ar.startsWith(q) || en.startsWith(q)) score = 1;
    scored.push({ p, score });
  });

  return scored.sort((a, b) => a.score - b.score).map((s) => s.p);
}

/**
 * Fallback for "الأكثر طلبًا" when the sales-history endpoint returns nothing
 * (e.g. a brand new install). Uses REAL menu data only - a spread across the
 * existing categories in their configured display order. No hardcoded names.
 */
export function fallbackTopSellers(products = [], categories = [], limit = 24) {
  const perCategory = new Map();
  products.forEach((p) => {
    if (!perCategory.has(p.categoryId)) perCategory.set(p.categoryId, []);
    perCategory.get(p.categoryId).push(p);
  });

  const ordered = [...categories].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  const picked = [];
  for (let round = 0; round < 3 && picked.length < limit; round += 1) {
    for (const cat of ordered) {
      const list = perCategory.get(cat.id);
      if (list && list[round]) {
        picked.push(list[round]);
        if (picked.length >= limit) break;
      }
    }
  }
  return picked;
}
