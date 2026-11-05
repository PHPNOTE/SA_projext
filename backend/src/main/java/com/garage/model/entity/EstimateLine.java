package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;

public record EstimateLine(
    Long lineId,
    Long estimateId,
    EstimateLineType lineType,
    Long partId,
    String description,
    int qty,
    BigDecimal unitPrice
) {
    public enum EstimateLineType {
        PART, LABOR
    }

    public static final RowMapper<EstimateLine> ROW_MAPPER = (rs, rowNum) -> new EstimateLine(
        rs.getLong("line_id"),
        rs.getLong("estimate_id"),
        EstimateLineType.valueOf(rs.getString("line_type")),
        rs.getObject("part_id", Long.class),
        rs.getString("description"),
        rs.getInt("qty"),
        rs.getBigDecimal("unit_price")
    );

    public EstimateLine withLineId(Long newId) {
        return new EstimateLine(newId, estimateId, lineType, partId, description, qty, unitPrice);
    }
}
