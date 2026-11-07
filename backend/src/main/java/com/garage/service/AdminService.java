package com.garage.service;

import com.garage.dto.AdminDtos.*;
import com.garage.exception.GarageException.*;
import com.garage.model.entity.RepairBay;
import com.garage.model.entity.StatusLog;
import com.garage.model.entity.StatusLog.EntityType;
import com.garage.model.entity.UserAccount;
import com.garage.model.entity.UserAccount.UserRole;
import com.garage.repository.RepairBayRepository;
import com.garage.repository.StatusLogRepository;
import com.garage.repository.UserAccountRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class AdminService {

    private final UserAccountRepository userRepository;
    private final RepairBayRepository bayRepository;
    private final PasswordEncoder passwordEncoder;
    private final StatusLogRepository statusLogRepository;

    public AdminService(
        UserAccountRepository userRepository,
        RepairBayRepository bayRepository,
        PasswordEncoder passwordEncoder,
        StatusLogRepository statusLogRepository
    ) {
        this.userRepository = userRepository;
        this.bayRepository = bayRepository;
        this.passwordEncoder = passwordEncoder;
        this.statusLogRepository = statusLogRepository;
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
        com.garage.util.InputValidator.requireUsername(username);
        if (req.displayName() != null && !req.displayName().trim().isEmpty()) {
            com.garage.util.InputValidator.requirePersonName(req.displayName(), "Staff full name");
        }
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
            log(EntityType.USER, updated.userId(), "UPDATED", currentUser.userId(), "แก้ไขบัญชีและสิทธิ์ " + updated.username());
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
            UserAccount saved = userRepository.save(newUser);
            log(EntityType.USER, saved.userId(), "CREATED", currentUser.userId(), "สร้างบัญชีผู้ใช้ " + saved.username());
            return saved;
        });
    }

    private void log(EntityType type, Long entityId, String action, Long userId, String note) {
        statusLogRepository.save(new StatusLog(null, type, entityId, null, action, userId, note, Instant.now()));
    }

    @Transactional
    public void deleteUser(Long userId, UserAccount currentUser) {
        if (currentUser == null || currentUser.role() != UserRole.MANAGER) {
            throw new AccessDeniedException("Only MANAGER can delete accounts");
        }
        if (currentUser.userId().equals(userId)) {
            throw new ValidationException("Cannot delete your own account");
        }
        UserAccount user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        if (!userRepository.deleteIfUnused(userId)) {
            throw new ValidationException("Cannot delete account that has repair history; deactivate it instead");
        }
        log(EntityType.USER, userId, "DELETED", currentUser.userId(), "ลบบัญชีผู้ใช้ " + user.username());
    }

    @Transactional
    public void deleteBay(Long bayId, UserAccount currentUser) {
        if (currentUser == null || currentUser.role() != UserRole.MANAGER) {
            throw new AccessDeniedException("Only MANAGER can delete repair bays");
        }
        RepairBay bay = bayRepository.findById(bayId)
            .orElseThrow(() -> new ResourceNotFoundException("Bay not found: " + bayId));
        if (!bayRepository.deleteIfUnused(bayId)) {
            throw new ValidationException("Cannot delete bay that has been used by repair orders; deactivate it instead");
        }
        log(EntityType.BAY, bayId, "DELETED", currentUser.userId(), "ลบช่องซ่อม " + bay.name());
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
        log(EntityType.USER, deactivated.userId(), "DEACTIVATED", currentUser.userId(), "ปิดใช้งานบัญชี " + deactivated.username());
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
        return createBay(req, null);
    }

    @Transactional
    public RepairBay createBay(CreateBayRequest req, UserAccount currentUser) {
        if (req == null || req.name() == null || req.name().trim().isEmpty()) {
            throw new ValidationException("Bay name required");
        }
        com.garage.util.InputValidator.requireMeaningfulText(req.name(), "Bay name");
        RepairBay bay = new RepairBay(null, req.name().trim(), true);
        RepairBay saved = bayRepository.save(bay);
        log(EntityType.BAY, saved.bayId(), "CREATED", currentUser != null ? currentUser.userId() : null, "สร้างช่องซ่อม " + saved.name());
        return saved;
    }

    @Transactional
    public RepairBay updateBay(Long bayId, UpdateBayRequest req) {
        return updateBay(bayId, req, null);
    }

    @Transactional
    public RepairBay updateBay(Long bayId, UpdateBayRequest req, UserAccount currentUser) {
        RepairBay existing = bayRepository.findById(bayId)
            .orElseThrow(() -> new ResourceNotFoundException("Bay not found: " + bayId));

        if (req.name() != null) {
            com.garage.util.InputValidator.requireMeaningfulText(req.name(), "Bay name");
        }
        String name = req.name() != null ? req.name().trim() : existing.name();
        boolean active = req.isActive() != null ? req.isActive() : existing.isActive();
        RepairBay updated = new RepairBay(existing.bayId(), name, active);
        bayRepository.update(updated);
        log(EntityType.BAY, bayId, "UPDATED", currentUser != null ? currentUser.userId() : null, "แก้ไขช่องซ่อม " + updated.name());
        return updated;
    }

    public List<UserAccount> getMechanics() {
        return userRepository.findAllActive().stream()
            .filter(u -> u.role() == UserRole.MECHANIC)
            .toList();
    }
}
