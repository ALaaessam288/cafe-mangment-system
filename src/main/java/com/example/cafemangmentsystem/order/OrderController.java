package com.example.cafemangmentsystem.order;

import com.example.cafemangmentsystem.order.dto.AddOrderItemRequest;
import com.example.cafemangmentsystem.order.dto.CancelOrderItemRequest;
import com.example.cafemangmentsystem.order.dto.OpenOrderRequest;
import com.example.cafemangmentsystem.order.dto.OrderResponse;
import com.example.cafemangmentsystem.order.dto.TransferTableRequest;
import com.example.cafemangmentsystem.order.dto.VoidOrderRequest;
import com.example.cafemangmentsystem.order.entity.OrderStatus;
import com.example.cafemangmentsystem.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

    @GetMapping("/{id}")
    public OrderResponse findById(@PathVariable Long id) {
        return orderService.findById(id);
    }

    @PostMapping("/{id}/items")
    public OrderResponse addItem(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal,
                                  @Valid @RequestBody AddOrderItemRequest request) {
        return orderService.addItem(id, principal.getId(), request);
    }

    @PutMapping("/{id}/items/{itemId}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public OrderResponse cancelItem(@PathVariable Long id, @PathVariable Long itemId,
                                     @AuthenticationPrincipal UserPrincipal principal,
                                     @Valid @RequestBody CancelOrderItemRequest request) {
        return orderService.cancelItem(id, itemId, principal.getId(), request);
    }

    @PutMapping("/{id}/send")
    public OrderResponse send(@PathVariable Long id) {
        return orderService.send(id);
    }

    @PutMapping("/{id}/table")
    public OrderResponse transferTable(@PathVariable Long id, @Valid @RequestBody TransferTableRequest request) {
        return orderService.transferTable(id, request);
    }

    @PutMapping("/{id}/void")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public OrderResponse voidOrder(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal,
                                    @Valid @RequestBody VoidOrderRequest request) {
        return orderService.voidOrder(id, principal.getId(), request);
    }

    @PutMapping("/{id}/close")
    public OrderResponse close(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal) {
        return orderService.close(id, principal.getId());
    }
}