package com.example.cafemangmentsystem.register;

import com.example.cafemangmentsystem.register.dto.RegisterRequest;
import com.example.cafemangmentsystem.register.dto.RegisterResponse;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/registers")
@RequiredArgsConstructor
public class RegisterController {

    private final RegisterService registerService;

    @GetMapping
    public List<RegisterResponse> findAll() {
        return registerService.findAll();
    }

    @GetMapping("/{id}")
    public RegisterResponse findById(@PathVariable Long id) {
        return registerService.findById(id);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponse create(@Valid @RequestBody RegisterRequest request) {
        return registerService.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public RegisterResponse update(@PathVariable Long id, @Valid @RequestBody RegisterRequest request) {
        return registerService.update(id, request);
    }

    @PutMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public RegisterResponse deactivate(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal) {
        return registerService.deactivate(id, principal.getId());
    }

    @PutMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public RegisterResponse activate(@PathVariable Long id) {
        return registerService.activate(id);
    }
}
