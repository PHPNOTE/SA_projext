package com.garage.repository.jdbc;

import com.garage.model.entity.SaleOrderLine;
import com.garage.repository.SaleOrderLineRepository;
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
public class JdbcSaleOrderLineRepository implements SaleOrderLineRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcSaleOrderLineRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public SaleOrderLine save(SaleOrderLine line) {
        String sql = """
            INSERT INTO sale_order_line (sale_id, part_id, qty, unit_price)
            VALUES (:saleId, :partId, :qty, :unitPrice)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("saleId", line.saleId())
            .addValue("partId", line.partId())
            .addValue("qty", line.qty())
            .addValue("unitPrice", line.unitPrice());

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"line_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return line.withLineId(generatedId);
    }

    @Override
    public void batchInsert(List<SaleOrderLine> lines) {
        if (lines == null || lines.isEmpty()) return;
        String sql = """
            INSERT INTO sale_order_line (sale_id, part_id, qty, unit_price)
            VALUES (?, ?, ?, ?)
            """;
        jdbcTemplate.batchUpdate(sql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                SaleOrderLine line = lines.get(i);
                ps.setLong(1, line.saleId());
                ps.setLong(2, line.partId());
                ps.setInt(3, line.qty());
                ps.setBigDecimal(4, line.unitPrice());
            }

            @Override
            public int getBatchSize() {
                return lines.size();
            }
        });
    }

    @Override
    public Optional<SaleOrderLine> findById(Long lineId) {
        String sql = "SELECT * FROM sale_order_line WHERE line_id = :lineId";
        return namedJdbc.query(sql, Map.of("lineId", lineId), SaleOrderLine.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<SaleOrderLine> findBySaleId(Long saleId) {
        String sql = "SELECT * FROM sale_order_line WHERE sale_id = :saleId ORDER BY line_id ASC";
        return namedJdbc.query(sql, Map.of("saleId", saleId), SaleOrderLine.ROW_MAPPER);
    }

    @Override
    public List<SaleOrderLine> findAll() {
        String sql = "SELECT * FROM sale_order_line ORDER BY line_id ASC";
        return namedJdbc.query(sql, Map.of(), SaleOrderLine.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sale_order_line", Long.class);
        return count != null ? count : 0L;
    }
}
