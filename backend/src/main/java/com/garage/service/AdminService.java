package com.garage.service;

import com.garage.dto.AdminDtos.*;
import com.garage.exception.GarageException.*;
import com.garage.model.entity.RepairBay;
import com.garage.model.entity.UserAccount;
import com.garage.model.entity.UserAccount.UserRole;
import com.garage.repository.RepairBayRepository;
import com.garage.repository.UserAccountRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminService {

    private final UserAccountRepository userRepository;
    private final RepairBayRepository bayRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminService(
        UserAccountRepository userRepository,
        RepairBayRepository bayRepository,
        PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.bayRepository = bayRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserAccount upsertUser(UpsertUserRequest req, UserAccount currentUser) {
        if (currentUser == null || currentUser.role() != UserRole.MANAGER) {
            throw new AccessDeniedException("Only MANAGER can manage user accounts");
        }
        if (req == null || req.username() == null || req.username().trim().isEmpty() || req.role() == null) {
            throw new ValidationException("Username and role required");
        }

        String username = req.username().trim();
        UserRole role;
        try {
            role = UserRole.valueOf(req.role().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Invalid user role: " + req.role());
        }

        return userRepository.findByUsername(username).map(existing -> {
            String displayName = req.displayName() != null ? req.displayName().trim() : existing.displayName();
            boolean active = req.isActive() != null ? req.isActive() : existing.isActive();
            UserAccount updated = new UserAccount(
                existing.userId(),
                existing.username(),
                existing.passwordHash(),
                displayName,
                role,
                active
            );
            userRepository.update(updated);
            return updated;
        }).orElseGet(() -> {
            String defaultHash = passwordEncoder.encode("password123");
            String displayName = req.displayName() != null ? req.displayName().trim() : username;
            UserAccount newUser = new UserAccount(
                null,
                username,
                defaultHash,
                displayName,
                role,
                true
            );
            return userRepository.save(newUser);
        });
    }

    @Transactional
    public UserAccount deactivateUser(Long userId, UserAccount currentUser) {
        if (currentUser == null || currentUser.role() != UserRole.MANAGER) {
            throw new AccessDeniedException("Only MANAGER can deactivate accounts");
        }

        UserAccount user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        UserAccount deactivated = new UserAccount(
            user.userId(),
            user.username(),
            user.passwordHash(),
            user.displayName(),
            user.role(),
            false
        );
        userRepository.update(deactivated);
        return deactivated;
    }

    public List<UserAccount> getAllUsers() {
        return userRepository.findAll();
    }

    public List<RepairBay> getAllBays() {
        return bayRepository.findAll();
    }

    @Transactional
    public RepairBay createBay(CreateBayRequest req) {
        if (req == null || req.name() == null || req.name().trim().isEmpty()) {
            throw new ValidationException("Bay name required");
        }
        RepairBay bay = new RepairBay(null, req.name().trim(), true);
        return bayRepository.save(bay);
    }

    @Transactional
    public RepairBay updateBay(Long bayId, UpdateBayRequest req) {
        RepairBay existing = bayRepository.findById(bayId)
            .orElseThrow(() -> new ResourceNotFoundException("Bay not found: " + bayId));

        String name = req.name() != null ? req.name().trim() : existing.name();
        boolean active = req.isActive() != null ? req.isActive() : existing.isActive();
        RepairBay updated = new RepairBay(existing.bayId(), name, active);
        bayRepository.update(updated);
        return updated;
    }

    public List<UserAccount> getMechanics() {
        return userRepository.findAllActive().stream()
            .filter(u -> u.role() == UserRole.MECHANIC)
            .toList();
    }
}
