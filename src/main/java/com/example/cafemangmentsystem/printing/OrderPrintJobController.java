package com.example.cafemangmentsystem.printing;

import com.example.cafemangmentsystem.printing.dto.PrintJobResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/orders/{orderId}/print-jobs")
@RequiredArgsConstructor
public class OrderPrintJobController {

    private final PrintJobService printJobService;

    @GetMapping
    public List<PrintJobResponse> findAllForOrder(@PathVariable Long orderId) {
        return printJobService.findAllForOrder(orderId);
    }
}