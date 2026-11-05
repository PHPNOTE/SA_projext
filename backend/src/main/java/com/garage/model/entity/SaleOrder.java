package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.time.Instant;

public record SaleOrder(
    Long saleId,
    String saleNo,
    Long customerId,
    SaleOrderStatus status,
    Long createdBy,
    Instant createdAt
) {
    public enum SaleOrderStatus {
        QUOTED, CONFIRMED, COMPLETED, CANCELLED
    }

    public static final RowMapper<SaleOrder> ROW_MAPPER = (rs, rowNum) -> new SaleOrder(
        rs.getLong("sale_id"),
        rs.getString("sale_no"),
        rs.getObject("customer_id", Long.class),
        SaleOrderStatus.valueOf(rs.getString("status")),
        rs.getLong("created_by"),
        rs.getTimestamp("created_at").toInstant()
    );

    public SaleOrder withSaleId(Long newId) {
        return new SaleOrder(newId, saleNo, customerId, status, createdBy, createdAt);
    }
}
