package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.time.Instant;

public record PartRequest(
    Long requestId,
    Long estimateLineId,
    Long saleOrderLineId,
    Long partId,
    int qty,
    int qtyIssued,
    int qtyReturned,
    PartRequestStatus status,
    Instant createdAt
) {
    public enum PartRequestStatus {
        RESERVED, BACKORDERED, ISSUED, RETURNED, CANCELLED
    }

    public static final RowMapper<PartRequest> ROW_MAPPER = (rs, rowNum) -> new PartRequest(
        rs.getLong("request_id"),
        rs.getObject("estimate_line_id", Long.class),
        rs.getObject("sale_order_line_id", Long.class),
        rs.getLong("part_id"),
        rs.getInt("qty"),
        rs.getInt("qty_issued"),
        rs.getInt("qty_returned"),
        PartRequestStatus.valueOf(rs.getString("status")),
        rs.getTimestamp("created_at").toInstant()
    );

    public PartRequest withRequestId(Long newId) {
        return new PartRequest(newId, estimateLineId, saleOrderLineId, partId, qty, qtyIssued, qtyReturned, status, createdAt);
    }
}
