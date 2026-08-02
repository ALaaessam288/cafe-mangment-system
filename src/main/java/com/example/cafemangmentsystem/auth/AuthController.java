package com.example.cafemangmentsystem.auth;

import com.example.cafemangmentsystem.auth.dto.LoginRequest;
import com.example.cafemangmentsystem.auth.dto.LoginResponse;
import com.example.cafemangmentsystem.auth.dto.RefreshRequest;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.security.UserPrincipal;
import com.example.cafemangmentsystem.security.jwt.JwtService;
import com.example.cafemangmentsystem.security.refresh.RefreshTokenService;
import com.example.cafemangmentsystem.security.refresh.RotationResult;
import com.example.cafemangmentsystem.tenant.TenantService;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final TenantAwareAuthenticator tenantAwareAuthenticator;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final TenantService tenantService;

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        Tenant tenant = tenantService.resolveLoginableTenant(request.tenantSlug());

        TenantContext.set(tenant.getId());
        try {
            var authentication = tenantAwareAuthenticator.authenticate(request.username(), request.password());

            UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
            String token = jwtService.generateToken(principal);
            String refreshToken = refreshTokenService.issue(principal.getId());
            String role = principal.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");

            return new LoginResponse(token, "Bearer", refreshToken, principal.getId(), principal.getUsername(),
                    principal.getFullName(), role);
        } finally {
            TenantContext.clear();
        }
    }

    @PostMapping("/refresh")
    public LoginResponse refresh(@Valid @RequestBody RefreshRequest request) {
        RotationResult result = refreshTokenService.rotate(request.refreshToken());
        UserPrincipal principal = new UserPrincipal(result.user());
        String token = jwtService.generateToken(principal);
        String role = principal.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");

        return new LoginResponse(token, "Bearer", result.rawRefreshToken(), principal.getId(), principal.getUsername(),
                principal.getFullName(), role);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshRequest request) {
        refreshTokenService.revoke(request.refreshToken());
    }

    @ExceptionHandler({BadCredentialsException.class, DisabledException.class})
    public ResponseEntity<Map<String, Object>> handleAuthFailure(Exception ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("status", 401, "error", "Unauthorized", "message", "Invalid username or password"));
    }
}