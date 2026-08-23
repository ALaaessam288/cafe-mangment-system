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

/* Order matters: the first definition whose keywords hit the category name
   wins. "إضافات" is checked before food/desserts so "إضافات الحلويات" lands in
   the additions group instead of the desserts one. */
export const GROUP_PHOTOS = {
  TOP_SELLERS: '/images/categories/top_sellers.jpg',
  EXTRAS: '/images/categories/snacks.jpg',
  DESSERTS: '/images/categories/desserts.jpg',
  HOT: '/images/categories/hot.jpg',
  COLD: '/images/categories/cold.jpg',
  JUICE: '/images/categories/juice.jpg',
  FOOD: '/images/categories/food.jpg',
  OTHER: '/images/categories/food.jpg',
};

const GROUP_DEFS = [
  {
    id: 'EXTRAS',
    label: 'إضافات',
    icon: '➕',
    photo: '/images/categories/snacks.jpg',
    keywords: ['اضاف', 'extra', 'addition', 'topping'],
  },
  {
    id: 'DESSERTS',
    label: 'حلويات',
    icon: '🍰',
    photo: '/images/categories/desserts.jpg',
    keywords: [
      'وافل', 'بان كيك', 'بانكيك', 'قشطوطه', 'مولتن', 'فادج', 'طاجن', 'فريسكا',
      'حلو', 'كيك', 'ايس كريم', 'waffle', 'pancake', 'molten', 'fudge', 'fresca',
      'dessert', 'cake', 'tagen', 'qashtota',
    ],
  },
  {
    id: 'HOT',
    label: 'مشروبات ساخنة',
    icon: '☕',
    photo: '/images/categories/hot.jpg',
    keywords: [
      'ساخن', 'اسبريسو', 'سخن', 'قهوه', 'شاي', 'ينسون', 'نسكافيه', 'هوت',
      'hot', 'espresso', 'coffee', 'tea',
    ],
  },
  {
    id: 'COLD',
    label: 'مشروبات ساقعة',
    icon: '🧊',
    photo: '/images/categories/cold.jpg',
    keywords: [
      'ايس', 'غازيه', 'موهيتو', 'بارد', 'ساقع', 'مياه', 'صودا',
      'iced', 'ice', 'soft', 'mojito', 'cold', 'soda', 'water',
    ],
  },
  {
    id: 'JUICE',
    label: 'عصائر وفرابيه',
    icon: '🥤',
    photo: '/images/categories/juice.jpg',
    keywords: [
      'عصير', 'فرابيه', 'ميلك', 'شيك', 'سموزي', 'كوكتيل',
      'juice', 'frappe', 'shake', 'smoo', 'cocktail',
    ],
  },
  {
    id: 'FOOD',
    label: 'مأكولات',
    icon: '🍔',
    photo: '/images/categories/food.jpg',
    keywords: [
      'ساندوتش', 'نجريسكو', 'كريب', 'بيتزا', 'سوري', 'برجر', 'وجب', 'ركن',
      'مقرمشات', 'بطاطس',
      'sandwich', 'negresco', 'crepe', 'pizza', 'burger', 'meal', 'fries',
    ],
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
      // No name hit: lean on the data the backend already gives us. Anything
      // routed to the kitchen / booked on the FOOD revenue line is food.
      const foodCount = catProducts.filter(isFoodProduct).length;
      def = catProducts.length > 0 && foodCount * 2 >= catProducts.length
        ? GROUP_DEFS.find((g) => g.id === 'FOOD')
        : OTHER_GROUP;
    }

    const bucket = ensure(def);
    bucket.categories.push(cat);
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
    (p) => ids.has(p.categoryId) && (categoryId == null || p.categoryId === categoryId)
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
