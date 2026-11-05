package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

public record UserAccount(
    Long userId,
    String username,
    String passwordHash,
    String displayName,
    UserRole role,
    boolean isActive
) {
    public enum UserRole {
        FRONT_DESK, MECHANIC, WAREHOUSE, SALES, MANAGER
    }

    public static final RowMapper<UserAccount> ROW_MAPPER = (rs, rowNum) -> new UserAccount(
        rs.getLong("user_id"),
        rs.getString("username"),
        rs.getString("password_hash"),
        rs.getString("display_name"),
        UserRole.valueOf(rs.getString("role")),
        rs.getBoolean("is_active")
    );

    public UserAccount withUserId(Long newId) {
        return new UserAccount(newId, username, passwordHash, displayName, role, isActive);
    }
}
