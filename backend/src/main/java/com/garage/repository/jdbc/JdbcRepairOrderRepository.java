package com.garage.repository.jdbc;

import com.garage.model.entity.RepairOrder;
import com.garage.repository.RepairOrderRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Repository
public class JdbcRepairOrderRepository implements RepairOrderRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcRepairOrderRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public RepairOrder save(RepairOrder ro) {
        String sql = """
            INSERT INTO repair_order (
                ticket_no, vehicle_id, complaint, queue_class, priority_reason,
                queued_at, status, hold_reason, bay_id, mechanic_id,
                insurer_name, claim_no, insurance_docs_received,
                insurance_covered_amount, created_by, created_at, closed_at
            ) VALUES (
                :ticketNo, :vehicleId, :complaint, :queueClass, :priorityReason,
                :queuedAt, :status, :holdReason, :bayId, :mechanicId,
                :insurerName, :claimNo, :insuranceDocsReceived,
                :insuranceCoveredAmount, :createdBy, :createdAt, :closedAt
            )
            """;

        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("ticketNo", ro.ticketNo())
            .addValue("vehicleId", ro.vehicleId())
            .addValue("complaint", ro.complaint())
            .addValue("queueClass", ro.queueClass().name())
            .addValue("priorityReason", ro.priorityReason())
            .addValue("queuedAt", Timestamp.from(ro.queuedAt()))
            .addValue("status", ro.status().name())
            .addValue("holdReason", ro.holdReason())
            .addValue("bayId", ro.bayId())
            .addValue("mechanicId", ro.mechanicId())
            .addValue("insurerName", ro.insurerName())
            .addValue("claimNo", ro.claimNo())
            .addValue("insuranceDocsReceived", ro.insuranceDocsReceived())
            .addValue("insuranceCoveredAmount", ro.insuranceCoveredAmount())
            .addValue("createdBy", ro.createdBy())
            .addValue("createdAt", Timestamp.from(ro.createdAt()))
            .addValue("closedAt", ro.closedAt() != null ? Timestamp.from(ro.closedAt()) : null);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"repair_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return ro.withRepairId(generatedId);
    }

    @Override
    public Optional<RepairOrder> findById(Long repairId) {
        String sql = "SELECT * FROM repair_order WHERE repair_id = :repairId";
        return namedJdbc.query(sql, Map.of("repairId", repairId), RepairOrder.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<RepairOrder> findByTicketNo(String ticketNo) {
        String sql = "SELECT * FROM repair_order WHERE ticket_no = :ticketNo";
        return namedJdbc.query(sql, Map.of("ticketNo", ticketNo), RepairOrder.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<RepairOrder> findNextQueuedForUpdate() {
        String sql = """
            SELECT * FROM repair_order
            WHERE status = 'QUEUED'
            ORDER BY 
                CASE 
                    WHEN queue_class = 'PRIORITY' OR queued_at < DATEADD('MINUTE', -120, NOW()) THEN 0 
                    ELSE 1 
                END,
                queued_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
            """;
        return namedJdbc.query(sql, Map.of(), RepairOrder.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<RepairOrder> findByStatus(RepairOrder.RepairOrderStatus status) {
        String sql = "SELECT * FROM repair_order WHERE status = :status ORDER BY queued_at ASC";
        return namedJdbc.query(sql, Map.of("status", status.name()), RepairOrder.ROW_MAPPER);
    }

    @Override
    public List<RepairOrder> findAll() {
        String sql = "SELECT * FROM repair_order ORDER BY repair_id ASC";
        return namedJdbc.query(sql, Map.of(), RepairOrder.ROW_MAPPER);
    }

    @Override
    public void updateStatusAndBay(Long repairId, RepairOrder.RepairOrderStatus status, Long bayId, Long mechanicId) {
        String sql = """
            UPDATE repair_order
            SET status = :status, bay_id = :bayId, mechanic_id = :mechanicId
            WHERE repair_id = :repairId
            """;
        namedJdbc.update(sql, new MapSqlParameterSource()
            .addValue("repairId", repairId)
            .addValue("status", status.name())
            .addValue("bayId", bayId)
            .addValue("mechanicId", mechanicId));
    }

    @Override
    public void updateClosedAt(Long repairId) {
        String sql = "UPDATE repair_order SET status = 'COMPLETED', closed_at = NOW() WHERE repair_id = :repairId";
        namedJdbc.update(sql, Map.of("repairId", repairId));
    }

    @Override
    public void update(RepairOrder ro) {
        String sql = """
            UPDATE repair_order SET
                ticket_no = :ticketNo,
                vehicle_id = :vehicleId,
                complaint = :complaint,
                queue_class = :queueClass,
                priority_reason = :priorityReason,
                queued_at = :queuedAt,
                status = :status,
                hold_reason = :holdReason,
                bay_id = :bayId,
                mechanic_id = :mechanicId,
                insurer_name = :insurerName,
                claim_no = :claimNo,
                insurance_docs_received = :insuranceDocsReceived,
                insurance_covered_amount = :insuranceCoveredAmount,
                closed_at = :closedAt
            WHERE repair_id = :repairId
            """;

        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("repairId", ro.repairId())
            .addValue("ticketNo", ro.ticketNo())
            .addValue("vehicleId", ro.vehicleId())
            .addValue("complaint", ro.complaint())
            .addValue("queueClass", ro.queueClass().name())
            .addValue("priorityReason", ro.priorityReason())
            .addValue("queuedAt", Timestamp.from(ro.queuedAt()))
            .addValue("status", ro.status().name())
            .addValue("holdReason", ro.holdReason())
            .addValue("bayId", ro.bayId())
            .addValue("mechanicId", ro.mechanicId())
            .addValue("insurerName", ro.insurerName())
            .addValue("claimNo", ro.claimNo())
            .addValue("insuranceDocsReceived", ro.insuranceDocsReceived())
            .addValue("insuranceCoveredAmount", ro.insuranceCoveredAmount())
            .addValue("closedAt", ro.closedAt() != null ? Timestamp.from(ro.closedAt()) : null);

        namedJdbc.update(sql, params);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM repair_order", Long.class);
        return count != null ? count : 0L;
    }
}
