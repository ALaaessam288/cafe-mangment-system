package com.caffio.order;

import com.caffio.order.dto.AddOrderItemRequest;
import com.caffio.order.dto.CancelOrderItemRequest;
import com.caffio.order.dto.OpenOrderRequest;
import com.caffio.order.dto.OrderResponse;
import com.caffio.order.dto.SetDeliveryFeeRequest;
import com.caffio.order.dto.TransferTableRequest;
import com.caffio.order.dto.UpdateItemQuantityRequest;
import com.caffio.order.dto.VoidOrderRequest;
import com.caffio.order.entity.OrderStatus;
import com.caffio.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse open(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody OpenOrderRequest request) {
        return orderService.open(principal.getId(), request);
    }

    @GetMapping
    public List<OrderResponse> findAll(@RequestParam(required = false) OrderStatus status) {
        return orderService.findAll(status);
    }

    /**
     * Orders still on the floor (not paid, closed, voided or refunded), optionally for one table.
     *
     * <p>The POS used to call the unfiltered list - every order the café has ever taken - on each
     * table tap and on every 20-second poll, then filter in the browser. That request grows by
     * every order sold, forever. This one is bounded by what is actually open right now.
     */
    @GetMapping("/active")
    public List<OrderResponse> findActive(@RequestParam(required = false) Long tableId) {
        return orderService.findActive(tableId);
    }

    @GetMapping("/{id}")
    public OrderResponse findById(@PathVariable Long id) {
        return orderService.findById(id);
    }

    /**

     * Several lines in one request. See {@code OrderService#addItems} for why this is one

     * transaction rather than a convenience wrapper over repeated calls.

     */

    @PostMapping("/{id}/items/bulk")

    public OrderResponse addItems(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal,

                                  @Valid @RequestBody com.caffio.order.dto.AddOrderItemsRequest request) {

        return orderService.addItems(id, principal.getId(), request.items());

    }


    @PostMapping("/{id}/items")
    public OrderResponse addItem(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal,
                                  @Valid @RequestBody AddOrderItemRequest request) {
        return orderService.addItem(id, principal.getId(), request);
    }

    @PutMapping("/{id}/items/{itemId}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CASHIER')")
    public OrderResponse cancelItem(@PathVariable Long id, @PathVariable Long itemId,
                                     @AuthenticationPrincipal UserPrincipal principal,
                                     @Valid @RequestBody CancelOrderItemRequest request) {
        return orderService.cancelItem(id, itemId, principal.getId(), request);
    }

    /**
     * Removes a line the kitchen has never seen. Open to every till role: correcting a mistap
     * before anything is sent is normal work, not an audited exception (see
     * {@link OrderService#removeUnsentItem}).
     */
    @DeleteMapping("/{id}/items/{itemId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CASHIER')")
    public OrderResponse removeUnsentItem(@PathVariable Long id, @PathVariable Long itemId) {
        return orderService.removeUnsentItem(id, itemId);
    }

    @PutMapping("/{id}/items/{itemId}/quantity")
    public OrderResponse updateItemQuantity(@PathVariable Long id, @PathVariable Long itemId,
                                            @Valid @RequestBody UpdateItemQuantityRequest request) {
        return orderService.updateItemQuantity(id, itemId, request.quantity());
    }

    @PutMapping("/{id}/send")
    public OrderResponse send(@PathVariable Long id) {
        return orderService.send(id);
    }

    @PutMapping("/{id}/serve")
    public OrderResponse serve(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal) {
        return orderService.serveOrder(id, principal.getId());
    }

    @PutMapping("/{id}/delivery-fee")
    public OrderResponse setDeliveryFee(@PathVariable Long id, @Valid @RequestBody SetDeliveryFeeRequest request) {
        return orderService.setDeliveryFee(id, request.amount());
    }

    @PutMapping("/{id}/service-fee")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CASHIER')")
    public OrderResponse setServiceFee(@PathVariable Long id, @Valid @RequestBody com.caffio.order.dto.SetServiceFeeRequest request) {
        return orderService.setServiceFee(id, request.amount());
    }

    @DeleteMapping("/{id}/service-fee")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CASHIER')")
    public OrderResponse clearServiceFee(@PathVariable Long id) {
        return orderService.setServiceFee(id, java.math.BigDecimal.ZERO);
    }

    @PutMapping("/{id}/table")
    public OrderResponse transferTable(@PathVariable Long id, @Valid @RequestBody TransferTableRequest request) {
        return orderService.transferTable(id, request);
    }

    @PutMapping("/{id}/void")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CASHIER')")
    public OrderResponse voidOrder(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal,
                                    @Valid @RequestBody VoidOrderRequest request) {
        return orderService.voidOrder(id, principal.getId(), request);
    }

    @PutMapping("/{id}/close")
    public OrderResponse close(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal) {
        return orderService.close(id, principal.getId());
    }

    @PostMapping("/{id}/checkout")
    public OrderResponse checkout(@PathVariable Long id,
                                  @AuthenticationPrincipal UserPrincipal principal,
                                  @Valid @RequestBody com.caffio.order.dto.CheckoutRequest request,
                                  @org.springframework.web.bind.annotation.RequestHeader(value = "X-Idempotency-Key", required = false) String headerKey) {
        return orderService.checkout(id, principal != null ? principal.getId() : null, request, headerKey);
    }
}