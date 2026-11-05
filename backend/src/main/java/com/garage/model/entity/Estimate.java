package com.garage.model.entity;

import org.springframework.jdbc.core.RowMapper;

import java.time.Instant;

public record Estimate(
    Long estimateId,
    Long repairId,
    int revisionNo,
    EstimateStatus status,
    String diagnosisNote,
    Long createdBy,
    Instant decidedAt
) {
    public enum EstimateStatus {
        DRAFT, PENDING, APPROVED, DECLINED
    }

    public static final RowMapper<Estimate> ROW_MAPPER = (rs, rowNum) -> new Estimate(
        rs.getLong("estimate_id"),
        rs.getLong("repair_id"),
        rs.getInt("revision_no"),
        EstimateStatus.valueOf(rs.getString("status")),
        rs.getString("diagnosis_note"),
        rs.getLong("created_by"),
        rs.getTimestamp("decided_at") != null ? rs.getTimestamp("decided_at").toInstant() : null
    );

    public Estimate withEstimateId(Long newId) {
        return new Estimate(newId, repairId, revisionNo, status, diagnosisNote, createdBy, decidedAt);
    }
}
