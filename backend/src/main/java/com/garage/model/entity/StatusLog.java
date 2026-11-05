package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.time.Instant;

public record StatusLog(
    Long logId,
    EntityType entityType,
    Long entityId,
    String fromStatus,
    String toStatus,
    Long userId,
    String note,
    Instant createdAt
) {
    public enum EntityType {
        REPAIR, ESTIMATE, PART_REQUEST, SALE, PO
    }

    public static final RowMapper<StatusLog> ROW_MAPPER = (rs, rowNum) -> new StatusLog(
        rs.getLong("log_id"),
        EntityType.valueOf(rs.getString("entity_type")),
        rs.getLong("entity_id"),
        rs.getString("from_status"),
        rs.getString("to_status"),
        rs.getObject("user_id", Long.class),
        rs.getString("note"),
        rs.getTimestamp("created_at").toInstant()
    );

    public StatusLog withLogId(Long newId) {
        return new StatusLog(newId, entityType, entityId, fromStatus, toStatus, userId, note, createdAt);
    }
}
