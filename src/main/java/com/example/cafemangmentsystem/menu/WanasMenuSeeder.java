package com.example.cafemangmentsystem.menu;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.menu.entity.Category;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.entity.ProductOption;
import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import com.example.cafemangmentsystem.menu.repository.CategoryRepository;
import com.example.cafemangmentsystem.menu.repository.ProductOptionRepository;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.station.entity.Station;
import com.example.cafemangmentsystem.station.entity.StationCode;
import com.example.cafemangmentsystem.station.repository.StationRepository;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
@RequiredArgsConstructor
public class WanasMenuSeeder {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final ProductOptionRepository productOptionRepository;
    private final StationRepository stationRepository;
    private final TenantRepository tenantRepository;
    private final org.springframework.transaction.support.TransactionTemplate transactionTemplate;

    public void seedMenuForAllTenants() {
        List<Tenant> tenants = tenantRepository.findAll();
        for (Tenant tenant : tenants) {
            try {
                TenantContext.set(tenant.getId());
                transactionTemplate.executeWithoutResult(status -> {
                    long catCount = categoryRepository.count();
                    if (catCount == 0) {
                        System.out.println("[WANAS SEEDER] Seeding complete Wanas Café menu for tenant: " + tenant.getSlug());
                        seedFullWanasMenu();
                    }
                });
            } catch (Exception e) {
                System.err.println("[WANAS SEEDER] Error seeding menu for tenant " + tenant.getSlug() + ": " + e.getMessage());
                e.printStackTrace();
            } finally {
                TenantContext.clear();
            }
        }
    }

    public void seedFullWanasMenu() {
        // Ensure Stations exist for the current tenant
        Station barStation = stationRepository.findFirstByCode(StationCode.BAR)
                .orElseGet(() -> {
                    Station s = new Station();
                    s.setCode(StationCode.BAR);
                    s.setNameAr("البار / الكافيه");
                    return stationRepository.save(s);
                });

        Station kitchenStation = stationRepository.findFirstByCode(StationCode.KITCHEN)
                .orElseGet(() -> {
                    Station s = new Station();
                    s.setCode(StationCode.KITCHEN);
                    s.setNameAr("المطبخ");
                    return stationRepository.save(s);
                });

        // ==================== 1. DRINKS (المشروبات) ====================

        // Category 1: مشروبات ساخنة
        Category catHotDrinks = createCat("مشروبات ساخنة", "Hot Drinks", 1);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "قهوة تركية سادة", 20);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "قهوة تركية دبل", 25);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "قهوة فرنساوي", 35);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "قهوة بندق قشطة", 40);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "نسكافيه بلاك", 15);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "نسكافيه", 25);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "هوت سيدر", 30);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "شاي سادة", 10);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "شاي أخضر", 15);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "شاي كرك", 25);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "يانسون", 15);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "نعناع", 15);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "ليمون", 20);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "كركديه", 20);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "قرفة", 20);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "جنزبيل", 20);
        createProd(catHotDrinks, barStation, RevenueLine.BUFFET, "ميكس أعشاب", 20);

        // Category 2: إسبريسو
        Category catEspresso = createCat("إسبريسو", "Espresso", 2);
        createProd(catEspresso, barStation, RevenueLine.BUFFET, "إسبريسو سنجل", 25);
        createProd(catEspresso, barStation, RevenueLine.BUFFET, "إسبريسو دبل", 35);
        createProd(catEspresso, barStation, RevenueLine.BUFFET, "لاتيه", 35);
        createProd(catEspresso, barStation, RevenueLine.BUFFET, "كابتشينو", 40);
        createProd(catEspresso, barStation, RevenueLine.BUFFET, "موكا", 45);
        createProd(catEspresso, barStation, RevenueLine.BUFFET, "فلات وايت", 45);
        createProd(catEspresso, barStation, RevenueLine.BUFFET, "سبانيش لاتيه", 50);

        // Category 3: فرابيه
        Category catFrappe = createCat("فرابيه", "Frappe", 3);
        createProd(catFrappe, barStation, RevenueLine.BUFFET, "فرابيه كلاسيك", 45);
        createProd(catFrappe, barStation, RevenueLine.BUFFET, "فرابيه كراميل", 55);
        createProd(catFrappe, barStation, RevenueLine.BUFFET, "فرابيه شوكولاتة", 55);
        createProd(catFrappe, barStation, RevenueLine.BUFFET, "فرابيه فانيليا", 55);
        createProd(catFrappe, barStation, RevenueLine.BUFFET, "فرابيه موكا", 55);
        createProd(catFrappe, barStation, RevenueLine.BUFFET, "فرابيه أوريو", 55);

        // Category 4: عصير فريش
        Category catFreshJuice = createCat("عصير فريش", "Fresh Juice", 4);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "برتقال", 35);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "مانجو", 50);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "فراولة", 45);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "ليمون", 25);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "ليمون نعناع", 35);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "كيوي", 50);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "أفوكادو", 70);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "جوافة", 40);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "جوافة نعناع", 45);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "بطيخ", 50);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "موز باللبن", 40);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "مانجا كيوي", 60);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "مانجا بطيخ", 55);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "مانجا فراولة", 60);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "فراولة موز", 55);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "جوافة فراولة", 55);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "برتقال جزر", 45);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "كوكتيل", 55);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "فروت سالاد", 60);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "قنبلة ونس", 70);
        createProd(catFreshJuice, barStation, RevenueLine.BUFFET, "ونس فروت سالاد", 80);

        // Category 5: موهيتو
        Category catMojito = createCat("موهيتو", "Mojito", 5);
        createProd(catMojito, barStation, RevenueLine.BUFFET, "موهيتو فراولة", 50);
        createProd(catMojito, barStation, RevenueLine.BUFFET, "موهيتو مانجا", 50);
        createProd(catMojito, barStation, RevenueLine.BUFFET, "موهيتو بطيخ", 50);
        createProd(catMojito, barStation, RevenueLine.BUFFET, "موهيتو كيوي", 50);
        createProd(catMojito, barStation, RevenueLine.BUFFET, "موهيتو بلو بيري", 50);
        createProd(catMojito, barStation, RevenueLine.BUFFET, "موهيتو ريد بول", 90);

        // Category 6: آيس كوفي
        Category catIcedCoffee = createCat("آيس كوفي", "Iced Coffee", 6);
        createProd(catIcedCoffee, barStation, RevenueLine.BUFFET, "آيس لاتيه كلاسيك", 50);
        createProd(catIcedCoffee, barStation, RevenueLine.BUFFET, "آيس لاتيه شوكليت", 60);
        createProd(catIcedCoffee, barStation, RevenueLine.BUFFET, "آيس لاتيه فانيليا", 60);
        createProd(catIcedCoffee, barStation, RevenueLine.BUFFET, "آيس لاتيه كراميل", 60);
        createProd(catIcedCoffee, barStation, RevenueLine.BUFFET, "آيس لاتيه لوتس", 60);
        createProd(catIcedCoffee, barStation, RevenueLine.BUFFET, "آيس موكا", 50);
        createProd(catIcedCoffee, barStation, RevenueLine.BUFFET, "آيس سبانيش لاتيه", 60);

        // Category 7: ميلك شيك
        Category catMilkshake = createCat("ميلك شيك", "Milk Shake", 7);
        createProd(catMilkshake, barStation, RevenueLine.BUFFET, "ميلك شيك شوكولاتة", 50);
        createProd(catMilkshake, barStation, RevenueLine.BUFFET, "ميلك شيك فانيليا", 50);
        createProd(catMilkshake, barStation, RevenueLine.BUFFET, "ميلك شيك فراولة", 50);
        createProd(catMilkshake, barStation, RevenueLine.BUFFET, "ميلك شيك كراميل", 50);
        createProd(catMilkshake, barStation, RevenueLine.BUFFET, "ميلك شيك لوتس", 50);
        createProd(catMilkshake, barStation, RevenueLine.BUFFET, "ميلك شيك أوريو", 50);
        createProd(catMilkshake, barStation, RevenueLine.BUFFET, "ميلك شيك هوهوز", 50);
        createProd(catMilkshake, barStation, RevenueLine.BUFFET, "ميلك شيك بلو بيري", 50);
        createProd(catMilkshake, barStation, RevenueLine.BUFFET, "ميلك شيك مكس بيري", 50);
        createProd(catMilkshake, barStation, RevenueLine.BUFFET, "ميلك شيك فستق", 55);

        // Category 8: سموزي
        Category catSmoozy = createCat("سموزي", "Smoozy", 8);
        createProd(catSmoozy, barStation, RevenueLine.BUFFET, "سموزي فراولة", 50);
        createProd(catSmoozy, barStation, RevenueLine.BUFFET, "سموزي مانجا", 50);
        createProd(catSmoozy, barStation, RevenueLine.BUFFET, "سموزي ليمون نعناع", 50);
        createProd(catSmoozy, barStation, RevenueLine.BUFFET, "سموزي كيوي", 60);
        createProd(catSmoozy, barStation, RevenueLine.BUFFET, "سموزي أناناس", 50);
        createProd(catSmoozy, barStation, RevenueLine.BUFFET, "سموزي بطيخ", 50);
        createProd(catSmoozy, barStation, RevenueLine.BUFFET, "سموزي بطيخ نعناع", 60);
        createProd(catSmoozy, barStation, RevenueLine.BUFFET, "سموزي بلو بيري", 50);
        createProd(catSmoozy, barStation, RevenueLine.BUFFET, "سموزي مكس بيري", 50);
        createProd(catSmoozy, barStation, RevenueLine.BUFFET, "سموزي مانجا كيوي", 60);

        // Category 9: مشروبات غازية
        Category catSoftDrinks = createCat("مشروبات غازية", "Soft Drinks", 9);
        createProd(catSoftDrinks, barStation, RevenueLine.BUFFET, "مياه", 10);
        createProd(catSoftDrinks, barStation, RevenueLine.BUFFET, "بيبسي", 25);
        createProd(catSoftDrinks, barStation, RevenueLine.BUFFET, "ميرندا برتقال", 25);
        createProd(catSoftDrinks, barStation, RevenueLine.BUFFET, "ميرندا تفاح", 25);
        createProd(catSoftDrinks, barStation, RevenueLine.BUFFET, "سبرايت", 25);
        createProd(catSoftDrinks, barStation, RevenueLine.BUFFET, "تويست", 25);
        createProd(catSoftDrinks, barStation, RevenueLine.BUFFET, "ستينج", 25);
        createProd(catSoftDrinks, barStation, RevenueLine.BUFFET, "شوبيس", 25);
        createProd(catSoftDrinks, barStation, RevenueLine.BUFFET, "فيروز", 30);
        createProd(catSoftDrinks, barStation, RevenueLine.BUFFET, "ريد بول", 80);

        // ==================== 2. DESSERTS (الحلويات) ====================

        // Category 10: وافل
        Category catWaffle = createCat("وافل", "Wafel", 10);
        createProd(catWaffle, barStation, RevenueLine.BUFFET, "دارك شوكليت", 50);
        createProd(catWaffle, barStation, RevenueLine.BUFFET, "نوتيلا", 50);
        createProd(catWaffle, barStation, RevenueLine.BUFFET, "كراميل", 55);
        createProd(catWaffle, barStation, RevenueLine.BUFFET, "لوتس", 60);
        createProd(catWaffle, barStation, RevenueLine.BUFFET, "وايت شوكولاتة", 50);
        createProd(catWaffle, barStation, RevenueLine.BUFFET, "أوريو", 65);
        createProd(catWaffle, barStation, RevenueLine.BUFFET, "هوهوز", 65);
        createProd(catWaffle, barStation, RevenueLine.BUFFET, "ميكس", 60);
        createProd(catWaffle, barStation, RevenueLine.BUFFET, "فواكه", 65);
        createProd(catWaffle, barStation, RevenueLine.BUFFET, "وافل ونس", 85);

        // Category 11: بان كيك
        Category catPancakes = createCat("بان كيك", "Pancakes", 11);
        createProd(catPancakes, barStation, RevenueLine.BUFFET, "نوتيلا", 60);
        createProd(catPancakes, barStation, RevenueLine.BUFFET, "لوتس", 75);
        createProd(catPancakes, barStation, RevenueLine.BUFFET, "وايت شوكولاتة", 60);
        createProd(catPancakes, barStation, RevenueLine.BUFFET, "كراميل", 75);
        createProd(catPancakes, barStation, RevenueLine.BUFFET, "أوريو", 75);
        createProd(catPancakes, barStation, RevenueLine.BUFFET, "ميكس", 75);
        createProd(catPancakes, barStation, RevenueLine.BUFFET, "هوهوز", 75);
        createProd(catPancakes, barStation, RevenueLine.BUFFET, "بان كيك ونس", 90);

        // Category 12: تيراميسو
        Category catTiramisu = createCat("تيراميسو", "Tiramisu", 12);
        createProd(catTiramisu, barStation, RevenueLine.BUFFET, "تيراميسو كلاسيك", 65);
        createProd(catTiramisu, barStation, RevenueLine.BUFFET, "تيراميسو نوتيلا", 70);
        createProd(catTiramisu, barStation, RevenueLine.BUFFET, "تيراميسو لوتس", 75);
        createProd(catTiramisu, barStation, RevenueLine.BUFFET, "تيراميسو مانجو", 70);
        createProd(catTiramisu, barStation, RevenueLine.BUFFET, "تيراميسو فراولة", 70);
        createProd(catTiramisu, barStation, RevenueLine.BUFFET, "تيراميسو أوريو", 75);

        // Category 13: قشطوطة
        Category catQashtota = createCat("قشطوطة", "Qashtota", 13);
        createProd(catQashtota, barStation, RevenueLine.BUFFET, "كراميل", 60);
        createProd(catQashtota, barStation, RevenueLine.BUFFET, "نوتيلا", 60);
        createProd(catQashtota, barStation, RevenueLine.BUFFET, "وايت شوكولاتة", 60);
        createProd(catQashtota, barStation, RevenueLine.BUFFET, "لوتس", 60);
        createProd(catQashtota, barStation, RevenueLine.BUFFET, "أوريو", 65);
        createProd(catQashtota, barStation, RevenueLine.BUFFET, "فواكه", 70);
        createProd(catQashtota, barStation, RevenueLine.BUFFET, "مانجا", 55);
        createProd(catQashtota, barStation, RevenueLine.BUFFET, "فراولة", 70);
        createProd(catQashtota, barStation, RevenueLine.BUFFET, "ميكس", 75);
        createProd(catQashtota, barStation, RevenueLine.BUFFET, "قشطوطة ونس", 80);

        // Category 14: مولتن
        Category catMolten = createCat("مولتن", "Molten", 14);
        createProd(catMolten, barStation, RevenueLine.BUFFET, "شوكولاتة", 60);
        createProd(catMolten, barStation, RevenueLine.BUFFET, "نوتيلا", 60);
        createProd(catMolten, barStation, RevenueLine.BUFFET, "وايت شوكولاتة", 60);
        createProd(catMolten, barStation, RevenueLine.BUFFET, "لوتس", 65);
        createProd(catMolten, barStation, RevenueLine.BUFFET, "أوريو", 70);
        createProd(catMolten, barStation, RevenueLine.BUFFET, "هوهوز", 70);
        createProd(catMolten, barStation, RevenueLine.BUFFET, "ميكس", 70);
        createProd(catMolten, barStation, RevenueLine.BUFFET, "مولتن ونس", 75);

        // Category 15: تشيز كيك
        Category catCheesecake = createCat("تشيز كيك", "Cheesecake", 15);
        createProd(catCheesecake, barStation, RevenueLine.BUFFET, "تشيز كيك لوتس", 75);
        createProd(catCheesecake, barStation, RevenueLine.BUFFET, "تشيز كيك نوتيلا", 75);
        createProd(catCheesecake, barStation, RevenueLine.BUFFET, "تشيز كيك أوريو", 75);
        createProd(catCheesecake, barStation, RevenueLine.BUFFET, "تشيز كيك مانجو", 70);
        createProd(catCheesecake, barStation, RevenueLine.BUFFET, "تشيز كيك فراولة", 70);
        createProd(catCheesecake, barStation, RevenueLine.BUFFET, "تشيز كيك بلوبيري", 75);
        createProd(catCheesecake, barStation, RevenueLine.BUFFET, "تشيز كيك كراميل", 70);

        // Category 16: فادج
        Category catFudge = createCat("فادج", "Fudge", 16);
        createProd(catFudge, barStation, RevenueLine.BUFFET, "كلاسيك", 60);
        createProd(catFudge, barStation, RevenueLine.BUFFET, "نوتيلا زيادة", 70);
        createProd(catFudge, barStation, RevenueLine.BUFFET, "وايت شوكولاتة", 60);
        createProd(catFudge, barStation, RevenueLine.BUFFET, "لوتس", 65);
        createProd(catFudge, barStation, RevenueLine.BUFFET, "أوريو", 70);
        createProd(catFudge, barStation, RevenueLine.BUFFET, "فواكه", 75);
        createProd(catFudge, barStation, RevenueLine.BUFFET, "ميكس", 75);
        createProd(catFudge, barStation, RevenueLine.BUFFET, "فادج ونس", 85);

        // Category 17: طاجن
        Category catTagen = createCat("طاجن", "Tagen", 17);
        createProd(catTagen, barStation, RevenueLine.BUFFET, "شوكولاتة", 50);
        createProd(catTagen, barStation, RevenueLine.BUFFET, "نوتيلا", 50);
        createProd(catTagen, barStation, RevenueLine.BUFFET, "وايت شوكولاتة", 60);
        createProd(catTagen, barStation, RevenueLine.BUFFET, "لوتس", 60);
        createProd(catTagen, barStation, RevenueLine.BUFFET, "أوريو", 60);
        createProd(catTagen, barStation, RevenueLine.BUFFET, "هوهوز", 60);
        createProd(catTagen, barStation, RevenueLine.BUFFET, "ميكس", 70);
        createProd(catTagen, barStation, RevenueLine.BUFFET, "طاجن ونس", 80);

        // Category 18: فريسكا
        Category catFresca = createCat("فريسكا", "Fresca", 18);
        createProd(catFresca, barStation, RevenueLine.BUFFET, "نوتيلا", 30);
        createProd(catFresca, barStation, RevenueLine.BUFFET, "وايت شوكولاتة", 30);
        createProd(catFresca, barStation, RevenueLine.BUFFET, "لوتس", 40);
        createProd(catFresca, barStation, RevenueLine.BUFFET, "موز", 45);
        createProd(catFresca, barStation, RevenueLine.BUFFET, "ميكس", 50);
        createProd(catFresca, barStation, RevenueLine.BUFFET, "فريسكا ونس", 60);

        // Category 19: براونيز
        Category catBrownies = createCat("براونيز", "Brownies", 19);
        createProd(catBrownies, barStation, RevenueLine.BUFFET, "براوني كلاسيك", 60);
        createProd(catBrownies, barStation, RevenueLine.BUFFET, "براوني نوتيلا", 70);
        createProd(catBrownies, barStation, RevenueLine.BUFFET, "براوني لوتس", 75);
        createProd(catBrownies, barStation, RevenueLine.BUFFET, "براوني تشيز كيك", 80);
        createProd(catBrownies, barStation, RevenueLine.BUFFET, "براوني كراميل مملح", 75);
        createProd(catBrownies, barStation, RevenueLine.BUFFET, "براوني وايت شوكليت", 70);
        createProd(catBrownies, barStation, RevenueLine.BUFFET, "براوني بالآيس كريم", 85);

        // Category 20: إضافات الحلويات
        Category catDessertExtras = createCat("إضافات الحلويات", "Dessert Extras", 20);
        createProd(catDessertExtras, barStation, RevenueLine.BUFFET, "كراميل", 20);
        createProd(catDessertExtras, barStation, RevenueLine.BUFFET, "شوكولاتة", 20);
        createProd(catDessertExtras, barStation, RevenueLine.BUFFET, "نوتيلا", 20);
        createProd(catDessertExtras, barStation, RevenueLine.BUFFET, "فانيليا", 20);
        createProd(catDessertExtras, barStation, RevenueLine.BUFFET, "بندق", 20);
        createProd(catDessertExtras, barStation, RevenueLine.BUFFET, "لبن", 20);
        createProd(catDessertExtras, barStation, RevenueLine.BUFFET, "آيس كريم", 20);
        createProd(catDessertExtras, barStation, RevenueLine.BUFFET, "مكسرات", 20);

        // ==================== 3. FOOD (المأكولات) ====================

        // Category 21: ركن الساندوتش
        Category catSandwiches = createCat("ركن الساندوتش", "Sandwich Corner", 21);
        createProd(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش زنجر (فرنساوي)", 50);
        createProd(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش كريس بي (فرنساوي)", 50);
        createProd(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش فراخ (فرنساوي)", 45);
        createProd(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش فاهيتا (فرنساوي)", 50);
        createProd(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش ميكس فراخ (فرنساوي)", 55);
        createProd(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش ميكس لحوم (فرنساوي)", 55);
        createProd(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش مجمج (فرنساوي)", 40);
        createProd(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش شاورما (فرنساوي)", 50);
        createProd(catSandwiches, kitchenStation, RevenueLine.FOOD, "حواوشي (بلدي)", 20);
        createProd(catSandwiches, kitchenStation, RevenueLine.FOOD, "حواوشي ونس", 50);

        createProdWithOptions(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش كبده", 20,
                new OptionSeed("بلدي", 0, true),
                new OptionSeed("فرنساوي", 20, false));

        createProdWithOptions(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش سجق", 20,
                new OptionSeed("بلدي", 0, true),
                new OptionSeed("فرنساوي", 15, false));

        createProdWithOptions(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش بطاطس", 15,
                new OptionSeed("بلدي", 0, true),
                new OptionSeed("فرنساوي", 15, false));

        createProdWithOptions(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش بانيه", 25,
                new OptionSeed("بلدي", 0, true),
                new OptionSeed("فرنساوي", 20, false));

        createProdWithOptions(catSandwiches, kitchenStation, RevenueLine.FOOD, "ساندوتش ستريبس", 25,
                new OptionSeed("بلدي", 0, true),
                new OptionSeed("فرنساوي", 20, false));

        // Category 22: ركن النجريسكو
        Category catNegresco = createCat("ركن النجريسكو", "Negresco Corner", 22);
        createProdWithOptions(catNegresco, kitchenStation, RevenueLine.FOOD, "نجريسكو فراخ", 85,
                new OptionSeed("صغير (S)", 0, true),
                new OptionSeed("كبير (L)", 15, false));

        createProdWithOptions(catNegresco, kitchenStation, RevenueLine.FOOD, "نجريسكو لحمة", 85,
                new OptionSeed("صغير (S)", 0, true),
                new OptionSeed("كبير (L)", 15, false));

        createProdWithOptions(catNegresco, kitchenStation, RevenueLine.FOOD, "نجريسكو سوسيس", 75,
                new OptionSeed("صغير (S)", 0, true),
                new OptionSeed("كبير (L)", 20, false));

        createProdWithOptions(catNegresco, kitchenStation, RevenueLine.FOOD, "نجريسكو ونس", 100,
                new OptionSeed("صغير (S)", 0, true),
                new OptionSeed("كبير (L)", 20, false));

        // Category 23: ركن الكريب
        Category catCrepe = createCat("ركن الكريب", "Crepe Corner", 23);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب شاورما", 85);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب زنجر", 90);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب كريس بي", 90);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب بانيه", 75);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب شيش", 90);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب فاهيتا", 95);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب سجق", 75);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب سوسيس", 75);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب ميكس لحوم", 110);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب ميكس فراخ", 110);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب بطاطس", 50);
        createProd(catCrepe, kitchenStation, RevenueLine.FOOD, "كريب ونس", 130);

        // Category 24: ركن البيتزا
        Category catPizza = createCat("ركن البيتزا", "Pizza Corner", 24);
        createProdWithOptions(catPizza, kitchenStation, RevenueLine.FOOD, "بيتزا فراخ", 100,
                new OptionSeed("صغير (S)", 0, true),
                new OptionSeed("وسط (M)", 30, false),
                new OptionSeed("كبير (L)", 60, false));

        createProdWithOptions(catPizza, kitchenStation, RevenueLine.FOOD, "بيتزا لحمة", 100,
                new OptionSeed("صغير (S)", 0, true),
                new OptionSeed("وسط (M)", 30, false),
                new OptionSeed("كبير (L)", 60, false));

        createProdWithOptions(catPizza, kitchenStation, RevenueLine.FOOD, "بيتزا زنجر", 110,
                new OptionSeed("صغير (S)", 0, true),
                new OptionSeed("وسط (M)", 30, false),
                new OptionSeed("كبير (L)", 60, false));

        createProdWithOptions(catPizza, kitchenStation, RevenueLine.FOOD, "بيتزا سجق", 100,
                new OptionSeed("صغير (S)", 0, true),
                new OptionSeed("وسط (M)", 30, false),
                new OptionSeed("كبير (L)", 60, false));

        createProdWithOptions(catPizza, kitchenStation, RevenueLine.FOOD, "بيتزا مكس جبن", 100,
                new OptionSeed("صغير (S)", 0, true),
                new OptionSeed("وسط (M)", 20, false),
                new OptionSeed("كبير (L)", 50, false));

        createProdWithOptions(catPizza, kitchenStation, RevenueLine.FOOD, "بيتزا مرجريتا", 90,
                new OptionSeed("صغير (S)", 0, true),
                new OptionSeed("وسط (M)", 20, false),
                new OptionSeed("كبير (L)", 40, false));

        createProd(catPizza, kitchenStation, RevenueLine.FOOD, "بيتزا ونس", 190);

        // Category 25: ركن السوري
        Category catSoury = createCat("ركن السوري", "Soury Corner", 25);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "بطاطس سوري", 30);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "بطاطس موتزريلا سوري", 40);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "بطاطس صاروخ سوري", 50);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "بطاطس + شاورما سوري", 85);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "زنجر سوري", 85);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "كريس بي سوري", 80);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "سجق سوري", 65);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "سوسيس سوري", 65);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "ميكس لحوم سوري", 90);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "ميكس فراخ سوري", 90);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "شاورما سوري", 80);
        createProd(catSoury, kitchenStation, RevenueLine.FOOD, "صارووخ ونس", 100);

        // Category 26: ركن البرجر
        Category catBurger = createCat("ركن البرجر", "Burger Corner", 26);
        createProdWithOptions(catBurger, kitchenStation, RevenueLine.FOOD, "برجر فراخ", 85,
                new OptionSeed("سنجل", 0, true),
                new OptionSeed("دبل", 65, false),
                new OptionSeed("تريبل", 105, false));

        createProdWithOptions(catBurger, kitchenStation, RevenueLine.FOOD, "برجر لحمة", 85,
                new OptionSeed("سنجل", 0, true),
                new OptionSeed("دبل", 65, false),
                new OptionSeed("تريبل", 105, false));

        createProdWithOptions(catBurger, kitchenStation, RevenueLine.FOOD, "برجر زنجر", 130,
                new OptionSeed("سنجل", 0, true),
                new OptionSeed("دبل", 50, false),
                new OptionSeed("تريبل", 70, false));

        createProdWithOptions(catBurger, kitchenStation, RevenueLine.FOOD, "برجر كريس بي", 130,
                new OptionSeed("سنجل", 0, true),
                new OptionSeed("دبل", 50, false),
                new OptionSeed("تريبل", 70, false));

        // Category 27: ركن الوجبات
        Category catMeals = createCat("ركن الوجبات", "Meals", 27);
        createProdWithNote(catMeals, kitchenStation, RevenueLine.FOOD, "وجبة زنجر", 120, "تشمل: أرز · بطاطس · رغيف خبز · تومية · كاتشب");
        createProdWithNote(catMeals, kitchenStation, RevenueLine.FOOD, "وجبة كريس بي", 120, "تشمل: أرز · بطاطس · رغيف خبز · تومية · كاتشب");

        // Category 28: إضافات المأكولات
        Category catFoodExtras = createCat("إضافات المأكولات", "Extras & Additions", 28);
        createProdWithOptions(catFoodExtras, kitchenStation, RevenueLine.FOOD, "بطاطس", 20,
                new OptionSeed("صغير", 0, true),
                new OptionSeed("كبير", 10, false));
        createProd(catFoodExtras, kitchenStation, RevenueLine.FOOD, "تومية", 15);
        createProd(catFoodExtras, kitchenStation, RevenueLine.FOOD, "تركي", 25);
        createProd(catFoodExtras, kitchenStation, RevenueLine.FOOD, "جبنة", 15);
        createProd(catFoodExtras, kitchenStation, RevenueLine.FOOD, "صوص حار", 15);
        createProd(catFoodExtras, kitchenStation, RevenueLine.FOOD, "مايونيز", 15);
        createProd(catFoodExtras, kitchenStation, RevenueLine.FOOD, "بربيكيو", 15);
        createProd(catFoodExtras, kitchenStation, RevenueLine.FOOD, "شيدر", 20);

        System.out.println("[WANAS SEEDER] Successfully seeded complete 28 categories and products!");
    }

    private Category createCat(String nameAr, String nameEn, int displayOrder) {
        Category c = new Category();
        c.setNameAr(nameAr);
        c.setNameEn(nameEn);
        c.setDisplayOrder(displayOrder);
        return categoryRepository.save(c);
    }

    private Product createProd(Category category, Station station, RevenueLine revenueLine, String nameAr, double price) {
        Product p = new Product();
        p.setCategory(category);
        p.setStation(station);
        p.setRevenueLine(revenueLine);
        p.setNameAr(nameAr);
        p.setPrice(BigDecimal.valueOf(price));
        p.setAvailable(true);
        p.setStockQuantity(0);
        p.setTrackInventory(false);
        p.setMinStockThreshold(0);
        return productRepository.save(p);
    }

    private Product createProdWithNote(Category category, Station station, RevenueLine revenueLine, String nameAr, double price, String prepNote) {
        Product p = new Product();
        p.setCategory(category);
        p.setStation(station);
        p.setRevenueLine(revenueLine);
        p.setNameAr(nameAr);
        p.setPrice(BigDecimal.valueOf(price));
        p.setAvailable(true);
        p.setPrepNote(prepNote);
        p.setStockQuantity(0);
        p.setTrackInventory(false);
        p.setMinStockThreshold(0);
        return productRepository.save(p);
    }

    private Product createProdWithOptions(Category category, Station station, RevenueLine revenueLine, String nameAr, double basePrice, OptionSeed... options) {
        Product p = new Product();
        p.setCategory(category);
        p.setStation(station);
        p.setRevenueLine(revenueLine);
        p.setNameAr(nameAr);
        p.setPrice(BigDecimal.valueOf(basePrice));
        p.setAvailable(true);
        p.setStockQuantity(0);
        p.setTrackInventory(false);
        p.setMinStockThreshold(0);
        Product product = productRepository.save(p);

        for (OptionSeed opt : options) {
            ProductOption po = new ProductOption();
            po.setProduct(product);
            po.setNameAr(opt.nameAr);
            po.setPriceDelta(BigDecimal.valueOf(opt.priceDelta));
            po.setDefault(opt.isDefault);
            productOptionRepository.save(po);
        }
        return product;
    }

    private record OptionSeed(String nameAr, double priceDelta, boolean isDefault) {}
}
