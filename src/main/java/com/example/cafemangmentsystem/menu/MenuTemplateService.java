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
            Category drinks = categoryRepository.save(Category.builder().nameAr("Drinks").build());
            productRepository.save(Product.builder().category(drinks).nameAr("Espresso").price(new BigDecimal("30.00")).revenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.BUFFET).build());
            productRepository.save(Product.builder().category(drinks).nameAr("Latte").price(new BigDecimal("45.00")).revenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.BUFFET).build());
            Category pastry = categoryRepository.save(Category.builder().nameAr("Pastry").build());
            productRepository.save(Product.builder().category(pastry).nameAr("Croissant").price(new BigDecimal("50.00")).revenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.FOOD).build());
        } else if ("EGYPTIAN_RESTAURANT".equalsIgnoreCase(templateId)) {
            Category food = categoryRepository.save(Category.builder().nameAr("Food").build());
            productRepository.save(Product.builder().category(food).nameAr("Koshary").price(new BigDecimal("40.00")).revenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.FOOD).build());
            productRepository.save(Product.builder().category(food).nameAr("Hawawshi").price(new BigDecimal("60.00")).revenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.FOOD).build());
        } else if ("CAFE_AND_RESTAURANT".equalsIgnoreCase(templateId)) {
            Category drinks = categoryRepository.save(Category.builder().nameAr("Drinks").build());
            productRepository.save(Product.builder().category(drinks).nameAr("Espresso").price(new BigDecimal("30.00")).revenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.BUFFET).build());
            Category food = categoryRepository.save(Category.builder().nameAr("Food").build());
            productRepository.save(Product.builder().category(food).nameAr("Koshary").price(new BigDecimal("40.00")).revenueLine(com.example.cafemangmentsystem.menu.entity.RevenueLine.FOOD).build());
        }
    }
}
