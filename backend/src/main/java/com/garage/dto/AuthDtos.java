package com.garage.dto;

public class AuthDtos {
    public record LoginRequest(
        String username,
        String password
    ) {}

    public record UserDto(
        Long id,
        String username,
        String displayName,
        String role
    ) {}

    public record LoginResponse(
        String token,
        UserDto user
    ) {}
}
