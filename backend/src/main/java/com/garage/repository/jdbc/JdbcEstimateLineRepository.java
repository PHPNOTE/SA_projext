package com.garage.repository.jdbc;

import com.garage.model.entity.EstimateLine;
import com.garage.repository.EstimateLineRepository;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Repository
public class JdbcEstimateLineRepository implements EstimateLineRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcEstimateLineRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public EstimateLine save(EstimateLine line) {
        String sql = """
            INSERT INTO estimate_line (estimate_id, line_type, part_id, description, qty, unit_price)
            VALUES (:estimateId, :lineType, :partId, :description, :qty, :unitPrice)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("estimateId", line.estimateId())
            .addValue("lineType", line.lineType().name())
            .addValue("partId", line.partId())
            .addValue("description", line.description())
            .addValue("qty", line.qty())
            .addValue("unitPrice", line.unitPrice());

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"line_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return line.withLineId(generatedId);
    }

    @Override
    public void batchInsert(List<EstimateLine> lines) {
        if (lines == null || lines.isEmpty()) return;
        String sql = """
            INSERT INTO estimate_line (estimate_id, line_type, part_id, description, qty, unit_price)
            VALUES (?, ?, ?, ?, ?, ?)
            """;
        jdbcTemplate.batchUpdate(sql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                EstimateLine line = lines.get(i);
                ps.setLong(1, line.estimateId());
                ps.setString(2, line.lineType().name());
                if (line.partId() != null) {
                    ps.setLong(3, line.partId());
                } else {
                    ps.setNull(3, Types.BIGINT);
                }
                ps.setString(4, line.description());
                ps.setInt(5, line.qty());
                ps.setBigDecimal(6, line.unitPrice());
            }

            @Override
            public int getBatchSize() {
                return lines.size();
            }
        });
    }

    @Override
    public Optional<EstimateLine> findById(Long lineId) {
        String sql = "SELECT * FROM estimate_line WHERE line_id = :lineId";
        return namedJdbc.query(sql, Map.of("lineId", lineId), EstimateLine.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<EstimateLine> findByEstimateId(Long estimateId) {
        String sql = "SELECT * FROM estimate_line WHERE estimate_id = :estimateId ORDER BY line_id ASC";
        return namedJdbc.query(sql, Map.of("estimateId", estimateId), EstimateLine.ROW_MAPPER);
    }

    @Override
    public void deleteByEstimateId(Long estimateId) {
        String sql = "DELETE FROM estimate_line WHERE estimate_id = :estimateId";
        namedJdbc.update(sql, Map.of("estimateId", estimateId));
    }

    @Override
    public List<EstimateLine> findAll() {
        String sql = "SELECT * FROM estimate_line ORDER BY line_id ASC";
        return namedJdbc.query(sql, Map.of(), EstimateLine.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM estimate_line", Long.class);
        return count != null ? count : 0L;
    }
}
