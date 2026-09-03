package com.example.cafemangmentsystem.billing.web;

import com.example.cafemangmentsystem.billing.PlanService;
import com.example.cafemangmentsystem.billing.dto.PlanDto;
import com.example.cafemangmentsystem.billing.entity.Feature;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * The plan catalogue.
 *
 * <p>{@code GET /api/plans} is intentionally open: the onboarding modal renders it before the
 * tenant has chosen anything, and a price list is public information anyway.
 */
@RestController
@RequiredArgsConstructor
public class PlanController {

    private final PlanService planService;

    @GetMapping("/api/plans")
    public List<PlanDto> catalogue() {
        return planService.publicCatalogue();
    }

    @GetMapping("/api/plans/features")
    public List<Map<String, String>> features() {
        return Arrays.stream(Feature.values())
                .map(feature -> Map.of("code", feature.name(), "displayName", feature.getDisplayNameAr()))
                .toList();
    }

    // ── Platform administration ─────────────────────────────────────────────

    @GetMapping("/api/admin/plans")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<PlanDto> all() {
        return planService.all();
    }

    @PostMapping("/api/admin/plans")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public PlanDto create(@RequestBody PlanService.PlanUpsert request) {
        return planService.create(request);
    }

    @PutMapping("/api/admin/plans/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public PlanDto update(@PathVariable Long id, @RequestBody PlanService.PlanUpsert request) {
        return planService.update(id, request);
    }

    @DeleteMapping("/api/admin/plans/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public PlanDto retire(@PathVariable Long id) {
        return planService.retire(id);
    }

    @GetMapping("/api/admin/plans/{id}/subscribers")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Long> subscribers(@PathVariable Long id) {
        return Map.of("count", planService.subscriberCount(id));
    }
}
