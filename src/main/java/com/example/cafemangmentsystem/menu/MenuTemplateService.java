package com.example.cafemangmentsystem.menu;

import com.example.cafemangmentsystem.menu.entity.Category;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.CategoryRepository;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class MenuTemplateService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void seedTemplate(String templateId) {
        if ("CLASSIC_CAFE".equalsIgnoreCase(templateId)) {
            Category drinks = new Category();
            drinks.setNameAr("مشروبات");
            drinks.setDisplayOrder(1);
            drinks = categoryRepository.save(drinks);

            Product p1 = new Product();
            p1.setCategory(drinks);
            p1.setNameAr("إسبريسو");
            p1.setPrice(new BigDecimal("30.00"));
            p1.setRevenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.BUFFET);
            productRepository.save(p1);

            Product p2 = new Product();
            p2.setCategory(drinks);
            p2.setNameAr("لاتيه");
            p2.setPrice(new BigDecimal("45.00"));
            p2.setRevenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.BUFFET);
            productRepository.save(p2);

            Category pastry = new Category();
            pastry.setNameAr("مخبوزات");
            pastry.setDisplayOrder(2);
            pastry = categoryRepository.save(pastry);

            Product p3 = new Product();
            p3.setCategory(pastry);
            p3.setNameAr("كرواسون");
            p3.setPrice(new BigDecimal("50.00"));
            p3.setRevenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.FOOD);
            productRepository.save(p3);
        } else if ("EGYPTIAN_RESTAURANT".equalsIgnoreCase(templateId)) {
            Category food = new Category();
            food.setNameAr("أطباق رئيسية");
            food.setDisplayOrder(1);
            food = categoryRepository.save(food);

            Product p1 = new Product();
            p1.setCategory(food);
            p1.setNameAr("كشري");
            p1.setPrice(new BigDecimal("40.00"));
            p1.setRevenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.FOOD);
            productRepository.save(p1);

            Product p2 = new Product();
            p2.setCategory(food);
            p2.setNameAr("حواوشي");
            p2.setPrice(new BigDecimal("60.00"));
            p2.setRevenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.FOOD);
            productRepository.save(p2);
        } else if ("CAFE_AND_RESTAURANT".equalsIgnoreCase(templateId)) {
            Category drinks = new Category();
            drinks.setNameAr("مشروبات");
            drinks.setDisplayOrder(1);
            drinks = categoryRepository.save(drinks);

            Product p1 = new Product();
            p1.setCategory(drinks);
            p1.setNameAr("إسبريسو");
            p1.setPrice(new BigDecimal("30.00"));
            p1.setRevenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.BUFFET);
            productRepository.save(p1);

            Category food = new Category();
            food.setNameAr("أطباق رئيسية");
            food.setDisplayOrder(2);
            food = categoryRepository.save(food);

            Product p2 = new Product();
            p2.setCategory(food);
            p2.setNameAr("كشري");
            p2.setPrice(new BigDecimal("40.00"));
            p2.setRevenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.FOOD);
            productRepository.save(p2);
        }
    }
}
