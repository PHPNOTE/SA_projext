package com.garage.repository.jdbc;

import com.garage.model.entity.PartRequest;
import com.garage.repository.PartRequestRepository;
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
public class JdbcPartRequestRepository implements PartRequestRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcPartRequestRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public PartRequest save(PartRequest req) {
        String sql = """
            INSERT INTO part_request (
                estimate_line_id, sale_order_line_id, part_id, qty, qty_issued, qty_returned, status, created_at
            ) VALUES (
                :estimateLineId, :saleOrderLineId, :partId, :qty, :qtyIssued, :qtyReturned, :status, :createdAt
            )
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("estimateLineId", req.estimateLineId())
            .addValue("saleOrderLineId", req.saleOrderLineId())
            .addValue("partId", req.partId())
            .addValue("qty", req.qty())
            .addValue("qtyIssued", req.qtyIssued())
            .addValue("qtyReturned", req.qtyReturned())
            .addValue("status", req.status().name())
            .addValue("createdAt", Timestamp.from(req.createdAt()));

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"request_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return req.withRequestId(generatedId);
    }

    @Override
    public Optional<PartRequest> findById(Long requestId) {
        String sql = "SELECT * FROM part_request WHERE request_id = :requestId";
        return namedJdbc.query(sql, Map.of("requestId", requestId), PartRequest.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<PartRequest> findByEstimateLineId(Long estimateLineId) {
        String sql = "SELECT * FROM part_request WHERE estimate_line_id = :estimateLineId";
        return namedJdbc.query(sql, Map.of("estimateLineId", estimateLineId), PartRequest.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<PartRequest> findBySaleOrderLineId(Long saleOrderLineId) {
        String sql = "SELECT * FROM part_request WHERE sale_order_line_id = :saleOrderLineId";
        return namedJdbc.query(sql, Map.of("saleOrderLineId", saleOrderLineId), PartRequest.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<PartRequest> findByPartIdAndStatus(Long partId, PartRequest.PartRequestStatus status) {
        String sql = "SELECT * FROM part_request WHERE part_id = :partId AND status = :status ORDER BY created_at ASC";
        return namedJdbc.query(sql, Map.of("partId", partId, "status", status.name()), PartRequest.ROW_MAPPER);
    }

    @Override
    public void updateStatusAndQtys(Long requestId, PartRequest.PartRequestStatus status, int qtyIssued, int qtyReturned) {
        String sql = """
            UPDATE part_request
            SET status = :status, qty_issued = :qtyIssued, qty_returned = :qtyReturned
            WHERE request_id = :requestId
            """;
        namedJdbc.update(sql, new MapSqlParameterSource()
            .addValue("requestId", requestId)
            .addValue("status", status.name())
            .addValue("qtyIssued", qtyIssued)
            .addValue("qtyReturned", qtyReturned));
    }

    @Override
    public List<PartRequest> findAll() {
        String sql = "SELECT * FROM part_request ORDER BY request_id ASC";
        return namedJdbc.query(sql, Map.of(), PartRequest.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM part_request", Long.class);
        return count != null ? count : 0L;
    }
}
