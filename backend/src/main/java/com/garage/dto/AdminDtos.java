package com.garage.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class AdminDtos {

    public record UpsertUserRequest(
        @JsonAlias({"username"})
        String username,

        @JsonAlias({"fullName", "displayName"})
        String displayName,

        @JsonAlias({"role"})
        String role,

        @JsonAlias({"isActive"})
        Boolean isActive
    ) {}

    public record CreateBayRequest(
        @JsonAlias({"name", "bayNumber"})
        String name
    ) {}

    public record UpdateBayRequest(
        @JsonAlias({"name", "bayNumber"})
        String name,

        @JsonAlias({"isActive"})
        Boolean isActive
    ) {}
}
