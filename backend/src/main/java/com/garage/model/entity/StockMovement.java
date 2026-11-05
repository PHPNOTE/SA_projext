package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.time.Instant;

public record StockMovement(
    Long movementId,
    Long partId,
    MovementType movementType,
    int deltaOnHand,
    int deltaReserved,
    Long partRequestId,
    Long poLineId,
    String reason,
    Long userId,
    Instant createdAt
) {
    public enum MovementType {
        RECEIPT, RESERVE, RELEASE, ISSUE, RETURN, ADJUST
    }

    public static final RowMapper<StockMovement> ROW_MAPPER = (rs, rowNum) -> new StockMovement(
        rs.getLong("movement_id"),
        rs.getLong("part_id"),
        MovementType.valueOf(rs.getString("movement_type")),
        rs.getInt("delta_on_hand"),
        rs.getInt("delta_reserved"),
        rs.getObject("part_request_id", Long.class),
        rs.getObject("po_line_id", Long.class),
        rs.getString("reason"),
        rs.getObject("user_id", Long.class),
        rs.getTimestamp("created_at").toInstant()
    );

    public StockMovement withMovementId(Long newId) {
        return new StockMovement(newId, partId, movementType, deltaOnHand, deltaReserved, partRequestId, poLineId, reason, userId, createdAt);
    }
}
