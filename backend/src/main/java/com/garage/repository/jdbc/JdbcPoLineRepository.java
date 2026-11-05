package com.garage.repository.jdbc;

import com.garage.model.entity.PoLine;
import com.garage.repository.PoLineRepository;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Repository
public class JdbcPoLineRepository implements PoLineRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcPoLineRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public PoLine save(PoLine line) {
        String sql = """
            INSERT INTO po_line (po_id, part_id, qty_ordered, qty_received, unit_cost)
            VALUES (:poId, :partId, :qtyOrdered, :qtyReceived, :unitCost)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("poId", line.poId())
            .addValue("partId", line.partId())
            .addValue("qtyOrdered", line.qtyOrdered())
            .addValue("qtyReceived", line.qtyReceived())
            .addValue("unitCost", line.unitCost());

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"po_line_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return line.withPoLineId(generatedId);
    }

    @Override
    public void batchInsert(List<PoLine> lines) {
        if (lines == null || lines.isEmpty()) return;
        String sql = """
            INSERT INTO po_line (po_id, part_id, qty_ordered, qty_received, unit_cost)
            VALUES (?, ?, ?, ?, ?)
            """;
        jdbcTemplate.batchUpdate(sql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                PoLine line = lines.get(i);
                ps.setLong(1, line.poId());
                ps.setLong(2, line.partId());
                ps.setInt(3, line.qtyOrdered());
                ps.setInt(4, line.qtyReceived());
                ps.setBigDecimal(5, line.unitCost());
            }

            @Override
            public int getBatchSize() {
                return lines.size();
            }
        });
    }

    @Override
    public Optional<PoLine> findById(Long poLineId) {
        String sql = "SELECT * FROM po_line WHERE po_line_id = :poLineId";
        return namedJdbc.query(sql, Map.of("poLineId", poLineId), PoLine.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<PoLine> findByPoId(Long poId) {
        String sql = "SELECT * FROM po_line WHERE po_id = :poId ORDER BY po_line_id ASC";
        return namedJdbc.query(sql, Map.of("poId", poId), PoLine.ROW_MAPPER);
    }

    @Override
    public void updateQtyReceived(Long poLineId, int qtyReceived) {
        String sql = "UPDATE po_line SET qty_received = :qtyReceived WHERE po_line_id = :poLineId";
        namedJdbc.update(sql, Map.of("poLineId", poLineId, "qtyReceived", qtyReceived));
    }

    @Override
    public List<PoLine> findAll() {
        String sql = "SELECT * FROM po_line ORDER BY po_line_id ASC";
        return namedJdbc.query(sql, Map.of(), PoLine.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM po_line", Long.class);
        return count != null ? count : 0L;
    }
}
