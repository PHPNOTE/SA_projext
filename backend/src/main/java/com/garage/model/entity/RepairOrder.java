package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;
import java.time.Instant;

public record RepairOrder(
    Long repairId,
    String ticketNo,
    Long vehicleId,
    String complaint,
    QueueClass queueClass,
    String priorityReason,
    Instant queuedAt,
    RepairOrderStatus status,
    String holdReason,
    Long bayId,
    Long mechanicId,
    String insurerName,
    String claimNo,
    boolean insuranceDocsReceived,
    BigDecimal insuranceCoveredAmount,
    Long createdBy,
    Instant createdAt,
    Instant closedAt
) {
    public enum QueueClass {
        NORMAL, PRIORITY
    }

    public enum RepairOrderStatus {
        QUEUED, IN_DIAGNOSIS, AWAITING_APPROVAL, IN_REPAIR, ON_HOLD, QC, AWAITING_PAYMENT, COMPLETED, CANCELLED
    }

    public static final RowMapper<RepairOrder> ROW_MAPPER = (rs, rowNum) -> new RepairOrder(
        rs.getLong("repair_id"),
        rs.getString("ticket_no"),
        rs.getLong("vehicle_id"),
        rs.getString("complaint"),
        QueueClass.valueOf(rs.getString("queue_class")),
        rs.getString("priority_reason"),
        rs.getTimestamp("queued_at").toInstant(),
        RepairOrderStatus.valueOf(rs.getString("status")),
        rs.getString("hold_reason"),
        rs.getObject("bay_id", Long.class),
        rs.getObject("mechanic_id", Long.class),
        rs.getString("insurer_name"),
        rs.getString("claim_no"),
        rs.getBoolean("insurance_docs_received"),
        rs.getBigDecimal("insurance_covered_amount"),
        rs.getLong("created_by"),
        rs.getTimestamp("created_at").toInstant(),
        rs.getTimestamp("closed_at") != null ? rs.getTimestamp("closed_at").toInstant() : null
    );

    public RepairOrder withRepairId(Long newId) {
        return new RepairOrder(newId, ticketNo, vehicleId, complaint, queueClass, priorityReason, queuedAt, status, holdReason, bayId, mechanicId, insurerName, claimNo, insuranceDocsReceived, insuranceCoveredAmount, createdBy, createdAt, closedAt);
    }
}
