package com.example.cafemangmentsystem.inventory.repository;

import com.example.cafemangmentsystem.inventory.entity.ProductRecipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRecipeRepository extends JpaRepository<ProductRecipe, Long> {
    List<ProductRecipe> findAllByProductId(Long productId);
    void deleteAllByProductId(Long productId);
}
