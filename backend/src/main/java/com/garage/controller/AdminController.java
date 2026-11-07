package com.garage.controller;

import com.garage.dto.AdminDtos.*;
import com.garage.model.entity.RepairBay;
import com.garage.model.entity.UserAccount;
import com.garage.repository.UserAccountRepository;
import com.garage.service.AdminService;
import com.garage.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final UserAccountRepository userRepository;
    private final AuthService authService;

    public AdminController(AdminService adminService, UserAccountRepository userRepository, AuthService authService) {
        this.adminService = adminService;
        this.userRepository = userRepository;
        this.authService = authService;
    }

    private UserAccount resolveUser(HttpServletRequest request) {
        UserAccount user = (UserAccount) request.getAttribute("currentUser");
        if (user == null) {
            String header = request.getHeader("Authorization");
            user = authService.resolveUserFromToken(header);
        }
        return user;
    }

    @PostMapping("/users")
    public ResponseEntity<UserAccount> upsertUser(@RequestBody UpsertUserRequest req, HttpServletRequest request) {
        UserAccount currentUser = resolveUser(request);
        boolean exists = req != null && req.username() != null && userRepository.findByUsername(req.username().trim()).isPresent();
        UserAccount user = adminService.upsertUser(req, currentUser);
        return ResponseEntity.status(exists ? HttpStatus.OK : HttpStatus.CREATED).body(user);
    }

    @PostMapping("/users/{id}/deactivate")
    public ResponseEntity<Map<String, Object>> deactivateUser(@PathVariable Long id, HttpServletRequest request) {
        UserAccount currentUser = resolveUser(request);
        UserAccount deactivated = adminService.deactivateUser(id, currentUser);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "User " + deactivated.username() + " deactivated");
        body.put("user", deactivated);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/users")
    public ResponseEntity<List<UserAccount>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @GetMapping("/bays")
    public ResponseEntity<List<RepairBay>> getAllBays() {
        return ResponseEntity.ok(adminService.getAllBays());
    }

    @PostMapping("/bays")
    public ResponseEntity<RepairBay> createBay(@RequestBody CreateBayRequest req, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.createBay(req, resolveUser(request)));
    }

    @PutMapping("/bays/{id}")
    public ResponseEntity<RepairBay> updateBay(@PathVariable Long id, @RequestBody UpdateBayRequest req, HttpServletRequest request) {
        return ResponseEntity.ok(adminService.updateBay(id, req, resolveUser(request)));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Map<String, Object>> deleteUser(@PathVariable Long id, HttpServletRequest request) {
        adminService.deleteUser(id, resolveUser(request));
        return ResponseEntity.ok(Map.of("message", "User " + id + " deleted"));
    }

    @DeleteMapping("/bays/{id}")
    public ResponseEntity<Map<String, Object>> deleteBay(@PathVariable Long id, HttpServletRequest request) {
        adminService.deleteBay(id, resolveUser(request));
        return ResponseEntity.ok(Map.of("message", "Bay " + id + " deleted"));
    }

    @GetMapping("/mechanics")
    public ResponseEntity<List<UserAccount>> getMechanics() {
        return ResponseEntity.ok(adminService.getMechanics());
    }

    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings() {
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("garageName", "อู่ซ่อมรถมาตรฐานพัฒนาการ");
        settings.put("vatRate", 0.07);
        settings.put("currency", "THB");
        settings.put("agingThresholdMinutes", 120);
        return ResponseEntity.ok(settings);
    }
}
