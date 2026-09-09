package com.example.cafemangmentsystem.inventory.repository;

import com.example.cafemangmentsystem.inventory.entity.ProductRecipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRecipeRepository extends JpaRepository<ProductRecipe, Long> {
    List<ProductRecipe> findAllByProductId(Long productId);
    void deleteAllByProductId(Long productId);

    /**
     * How much of each ingredient is already spoken for by tickets that have not been sent yet,
     * summed across <em>every</em> product that consumes it.
     *
     * <p>Availability used to subtract a hold measured per product
     * ({@code sumNewQuantityByProductId}), which is only correct when no two products share an
     * ingredient. With one tin of beans behind both the espresso and the latte, ten pending
     * espressos were invisible to the question "how many more lattes can I take", and the café
     * accepted orders it had no beans for. Ingredients are what run out, so the hold is counted
     * against the ingredient.
     *
     * @return rows of {@code [auditItemId, reservedQuantity]} in the ingredient's own unit
     */
    @Query("""
            SELECT r.auditItem.id, COALESCE(SUM(oi.quantity * r.deductionQuantity), 0)
            FROM com.example.cafemangmentsystem.order.entity.OrderItem oi
            JOIN ProductRecipe r ON r.product.id = oi.product.id
            WHERE oi.status = com.example.cafemangmentsystem.order.entity.OrderItemStatus.NEW
            GROUP BY r.auditItem.id
            """)
    List<Object[]> sumReservedByIngredient();
}
