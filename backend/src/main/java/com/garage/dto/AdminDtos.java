package com.garage.dto;

public class AdminDtos {

    public record UpsertUserRequest(
        String username,
        String displayName,
        String role,
        Boolean isActive
    ) {}

    public record CreateBayRequest(
        String name
    ) {}

    public record UpdateBayRequest(
        String name,
        Boolean isActive
    ) {}
}
