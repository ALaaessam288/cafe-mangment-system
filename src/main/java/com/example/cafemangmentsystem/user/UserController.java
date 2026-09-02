package com.example.cafemangmentsystem.user;

import com.example.cafemangmentsystem.security.UserPrincipal;
import com.example.cafemangmentsystem.user.dto.ChangePasswordRequest;
import com.example.cafemangmentsystem.user.dto.CreateUserRequest;
import com.example.cafemangmentsystem.user.dto.UpdateUserRequest;
import com.example.cafemangmentsystem.user.dto.UserResponse;
import com.example.cafemangmentsystem.user.entity.Role;
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
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal UserPrincipal principal) {
        return userService.findById(principal.getId());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        assertCanAssignRole(principal, request.role());
        return userService.create(request);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public List<UserResponse> findAll() {
        return userService.findAll();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public UserResponse findById(@PathVariable Long id) {
        return userService.findById(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public UserResponse update(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        assertCanManageTarget(principal, userService.findById(id));
        assertCanAssignRole(principal, request.role());
        return userService.update(id, request);
    }

    @PutMapping("/{id}/password")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public void changePassword(@PathVariable Long id, @Valid @RequestBody ChangePasswordRequest request,
                               @AuthenticationPrincipal UserPrincipal principal) {
        assertCanManageTarget(principal, userService.findById(id));
        userService.changePassword(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public UserResponse deactivate(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal) {
        UserResponse target = userService.findById(id);
        assertCanManageTarget(principal, target);
        return userService.deactivate(id, principal.getId());
    }

    @PutMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public UserResponse activate(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal) {
        assertCanManageTarget(principal, userService.findById(id));
        return userService.activate(id);
    }

    private void assertCanAssignRole(UserPrincipal principal, Role requestedRole) {
        if (requestedRole == Role.SUPER_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "SUPER_ADMIN is a platform-only role");
        }
        if (!isAdmin(principal) && requestedRole != Role.CASHIER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Supervisors may create or assign cashier accounts only");
        }
    }

    private void assertCanManageTarget(UserPrincipal principal, UserResponse target) {
        if (target.role() == Role.SUPER_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Platform identities cannot be managed through tenant APIs");
        }
        if (!isAdmin(principal) && target.role() != Role.CASHIER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Supervisors may manage cashier accounts only");
        }
    }

    private boolean isAdmin(UserPrincipal principal) {
        return principal.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
