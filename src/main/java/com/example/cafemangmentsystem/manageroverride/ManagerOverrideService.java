package com.example.cafemangmentsystem.manageroverride;

import com.example.cafemangmentsystem.manageroverride.dto.ManagerOverrideResponse;
import com.example.cafemangmentsystem.manageroverride.dto.VerifyOverrideRequest;
import com.example.cafemangmentsystem.manageroverride.entity.ManagerOverride;
import com.example.cafemangmentsystem.manageroverride.entity.ManagerOverrideType;
import com.example.cafemangmentsystem.manageroverride.repository.ManagerOverrideRepository;
import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ManagerOverrideService {

    private final ManagerOverrideRepository managerOverrideRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public ManagerOverrideResponse verifyAndRecord(Long cashierId, VerifyOverrideRequest request) {
        User cashier = null;
        if (cashierId != null) {
            cashier = userRepository.findById(cashierId).orElse(null);
        }

        // Find active supervisor or admin with matching PIN
        String pin = request.supervisorPin().trim();
        User supervisor = userRepository.findAll().stream()
                .filter(u -> u.isActive() && (u.getRole() == Role.ADMIN || u.getRole() == Role.SUPERVISOR))
                .filter(u -> (u.getPinHash() != null && passwordEncoder.matches(pin, u.getPinHash())) ||
                             (u.getPasswordHash() != null && passwordEncoder.matches(pin, u.getPasswordHash())))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "رمز المشرف PIN غير صحيح أو ليس لديك صلاحية اعتماد"));

        ManagerOverride override = ManagerOverride.builder()
                .supervisor(supervisor)
                .cashier(cashier)
                .actionType(request.actionType())
                .orderId(request.orderId())
                .shiftId(request.shiftId())
                .amount(request.amount())
                .reason(request.reason())
                .details(request.details())
                .performedAt(Instant.now())
                .build();

        ManagerOverride saved = managerOverrideRepository.save(override);
        return ManagerOverrideResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ManagerOverrideResponse> listAll() {
        return managerOverrideRepository.findAllByOrderByPerformedAtDesc()
                .stream()
                .map(ManagerOverrideResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ManagerOverrideResponse> listByShift(Long shiftId) {
        return managerOverrideRepository.findAllByShiftIdOrderByPerformedAtDesc(shiftId)
                .stream()
                .map(ManagerOverrideResponse::from)
                .toList();
    }
}
