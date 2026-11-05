/* Which product the «إضافة مياه» button adds.

   The owner's choice in Settings wins. Without one, fall back to the old behaviour - the first
   product whose name says water - so a café that never opens Settings sees no change.

   Reads the menu the screen already has. The button used to download the whole menu on every
   press just to search it, which is a full menu request for one bottle of water. */
export function findWaterProduct(products = [], defaultWaterProductId = null) {
  if (defaultWaterProductId != null) {
    const chosen = products.find((p) => p.id === defaultWaterProductId);
    if (chosen) return chosen;
  }
  return products.find((p) => {
    const nameAr = (p.nameAr || p.name || '').toLowerCase();
    const nameEn = (p.nameEn || '').toLowerCase();
    return nameAr.includes('مياه') || nameEn.includes('water');
  }) ?? null;
}
