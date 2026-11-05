package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.time.Instant;
import java.time.LocalDate;

public record PurchaseOrder(
    Long poId,
    String poNo,
    String supplierName,
    PurchaseOrderStatus status,
    LocalDate expectedDate,
    Long createdBy,
    Instant createdAt,
    Instant orderedAt
) {
    public enum PurchaseOrderStatus {
        DRAFT, ORDERED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED
    }

    public static final RowMapper<PurchaseOrder> ROW_MAPPER = (rs, rowNum) -> new PurchaseOrder(
        rs.getLong("po_id"),
        rs.getString("po_no"),
        rs.getString("supplier_name"),
        PurchaseOrderStatus.valueOf(rs.getString("status")),
        rs.getDate("expected_date") != null ? rs.getDate("expected_date").toLocalDate() : null,
        rs.getLong("created_by"),
        rs.getTimestamp("created_at").toInstant(),
        rs.getTimestamp("ordered_at") != null ? rs.getTimestamp("ordered_at").toInstant() : null
    );

    public PurchaseOrder withPoId(Long newId) {
        return new PurchaseOrder(newId, poNo, supplierName, status, expectedDate, createdBy, createdAt, orderedAt);
    }
}
