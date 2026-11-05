package com.garage.controller;

import com.garage.dto.AuthDtos.LoginRequest;
import com.garage.dto.AuthDtos.LoginResponse;
import com.garage.dto.AuthDtos.UserDto;
import com.garage.exception.GarageException.UnauthorizedException;
import com.garage.model.entity.UserAccount;
import com.garage.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest req) {
        LoginResponse response = authService.login(req);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me(HttpServletRequest request) {
        UserAccount user = (UserAccount) request.getAttribute("currentUser");
        if (user == null) {
            String authHeader = request.getHeader("Authorization");
            user = authService.resolveUserFromToken(authHeader);
        }
        if (user == null) {
            throw new UnauthorizedException("Not authenticated");
        }
        return ResponseEntity.ok(new UserDto(user.userId(), user.username(), user.displayName(), user.role().name()));
    }
}
