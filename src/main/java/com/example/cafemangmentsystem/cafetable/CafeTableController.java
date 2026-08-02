package com.example.cafemangmentsystem.cafetable;

import com.example.cafemangmentsystem.cafetable.dto.CafeTableRequest;
import com.example.cafemangmentsystem.cafetable.dto.CafeTableResponse;
import com.example.cafemangmentsystem.security.UserPrincipal;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tables")
@RequiredArgsConstructor
public class CafeTableController {

    private final CafeTableService cafeTableService;

    @GetMapping
    public List<CafeTableResponse> findAll() {
        return cafeTableService.findAll();
    }

    @GetMapping("/{id}")
    public CafeTableResponse findById(@PathVariable Long id) {
        return cafeTableService.findById(id);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public CafeTableResponse create(@Valid @RequestBody CafeTableRequest request) {
        return cafeTableService.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CafeTableResponse update(@PathVariable Long id, @Valid @RequestBody CafeTableRequest request) {
        return cafeTableService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CafeTableResponse deactivate(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal) {
        return cafeTableService.deactivate(id, principal.getId());
    }

    @PutMapping("/{id}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public CafeTableResponse activate(@PathVariable Long id) {
        return cafeTableService.activate(id);
    }
}