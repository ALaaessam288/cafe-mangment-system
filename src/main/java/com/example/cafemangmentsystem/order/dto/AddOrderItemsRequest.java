package com.example.cafemangmentsystem.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Several lines added to an order in one call.
 *
 * <p>{@code @Valid} on the list matters: without it the nested records are not validated at all and
 * a null productId reaches the service as a 500 instead of a 400.
 *
 * <p>The size cap is not a guess at a reasonable order — it is a limit on how much work one request
 * can ask for inside a single transaction. Each line reserves stock and validates a recipe.
 */
public record AddOrderItemsRequest(
        @NotEmpty(message = "لا يوجد أصناف لإضافتها")
        @Size(max = 100, message = "عدد كبير جداً من الأصناف في طلب واحد")
        @Valid
        List<AddOrderItemRequest> items
) {
}
