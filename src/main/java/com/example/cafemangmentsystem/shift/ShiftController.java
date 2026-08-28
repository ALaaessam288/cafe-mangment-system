package com.example.cafemangmentsystem.shift;

import com.example.cafemangmentsystem.security.UserPrincipal;
import com.example.cafemangmentsystem.shift.dto.CloseShiftRequest;
import com.example.cafemangmentsystem.shift.dto.OpenShiftRequest;
import com.example.cafemangmentsystem.shift.dto.ShiftReportResponse;
import com.example.cafemangmentsystem.shift.dto.ShiftResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import com.example.cafemangmentsystem.shift.dto.SetSnacksNetRequest;

@RestController
@RequestMapping("/api/shifts")
@RequiredArgsConstructor
public class ShiftController {

    private final ShiftService shiftService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CASHIER')")
    public ShiftResponse open(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody OpenShiftRequest request) {
        return shiftService.open(principal.getId(), request);
    }

    @PutMapping("/{id}/close")
    public ShiftResponse close(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal,
                                @Valid @RequestBody CloseShiftRequest request) {
        return shiftService.close(id, principal.getId(), request);
    }

    @PutMapping("/{id}/force-close")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public ShiftResponse forceClose(@PathVariable Long id, @Valid @RequestBody CloseShiftRequest request) {
        return shiftService.forceClose(id, request);
    }

    @PutMapping("/{id}/snacks-net")
    public ShiftResponse setSnacksNet(@PathVariable Long id, @Valid @RequestBody SetSnacksNetRequest request) {
        return shiftService.setSnacksNet(id, request.amount());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        shiftService.delete(id);
    }

    @GetMapping("/me/current")
    public ShiftResponse currentForMe(@AuthenticationPrincipal UserPrincipal principal) {
        return shiftService.findCurrentForUser(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No open shift for the current user"));
    }

    @GetMapping("/{id}")
    public ShiftResponse findById(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal) {
        ShiftResponse shift = shiftService.findById(id);
        boolean isOwner = shift.userId().equals(principal.getId());
        boolean isPrivileged = principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_SUPERVISOR"));
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only view your own shift");
        }
        return shift;
    }

    @GetMapping("/{id}/report")
    public ShiftReportResponse getReport(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal) {
        ShiftResponse shift = shiftService.findById(id);
        boolean isOwner = shift.userId().equals(principal.getId());
        boolean isPrivileged = principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_SUPERVISOR"));
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only view your own shift report");
        }
        return shiftService.getShiftReport(id);
    }

    @GetMapping
    public List<ShiftResponse> findAll(@AuthenticationPrincipal UserPrincipal principal,
                                       @RequestParam(required = false, defaultValue = "false") boolean openOnly) {
        boolean isPrivileged = principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_SUPERVISOR"));
        if (isPrivileged) {
            return shiftService.findAll(openOnly);
        } else {
            return shiftService.findAllByUserId(principal.getId(), openOnly);
        }
    }
}