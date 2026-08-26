package com.example.cafemangmentsystem.register;

import com.example.cafemangmentsystem.register.dto.RegisterRequest;
import com.example.cafemangmentsystem.register.dto.RegisterResponse;
import com.example.cafemangmentsystem.register.entity.Register;
import com.example.cafemangmentsystem.register.repository.RegisterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class RegisterService {

    private final RegisterRepository registerRepository;

    public RegisterResponse create(RegisterRequest request) {
        Register register = Register.builder()
                .name(request.name())
                .build();

        return RegisterResponse.from(registerRepository.save(register));
    }

    public List<RegisterResponse> findAll() {
        List<Register> list = registerRepository.findAll();
        if (list.isEmpty()) {
            Register defaultRegister = Register.builder()
                    .name("الكاشير الرئيسي (الدرج 1)")
                    .build();
            list = List.of(registerRepository.save(defaultRegister));
        }
        return list.stream()
                .map(RegisterResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public RegisterResponse findById(Long id) {
        return RegisterResponse.from(getOrThrow(id));
    }

    public RegisterResponse update(Long id, RegisterRequest request) {
        Register register = getOrThrow(id);
        register.setName(request.name());
        return RegisterResponse.from(register);
    }

    public RegisterResponse deactivate(Long id, Long deactivatedByUserId) {
        Register register = getOrThrow(id);
        register.deactivate(deactivatedByUserId);
        return RegisterResponse.from(register);
    }

    public RegisterResponse activate(Long id) {
        Register register = getOrThrow(id);
        register.activate();
        return RegisterResponse.from(register);
    }

    private Register getOrThrow(Long id) {
        return registerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Register not found: " + id));
    }
}
