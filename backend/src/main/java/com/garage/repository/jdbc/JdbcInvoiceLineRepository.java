package com.garage.repository.jdbc;

import com.garage.model.entity.InvoiceLine;
import com.garage.repository.InvoiceLineRepository;
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
public class JdbcInvoiceLineRepository implements InvoiceLineRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcInvoiceLineRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public InvoiceLine save(InvoiceLine line) {
        String sql = """
            INSERT INTO invoice_line (invoice_id, part_id, description, qty, unit_price, line_total)
            VALUES (:invoiceId, :partId, :description, :qty, :unitPrice, :lineTotal)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("invoiceId", line.invoiceId())
            .addValue("partId", line.partId())
            .addValue("description", line.description())
            .addValue("qty", line.qty())
            .addValue("unitPrice", line.unitPrice())
            .addValue("lineTotal", line.lineTotal());

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"line_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return line.withLineId(generatedId);
    }

    @Override
    public void batchInsert(List<InvoiceLine> lines) {
        if (lines == null || lines.isEmpty()) return;
        String sql = """
            INSERT INTO invoice_line (invoice_id, part_id, description, qty, unit_price, line_total)
            VALUES (?, ?, ?, ?, ?, ?)
            """;
        jdbcTemplate.batchUpdate(sql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                InvoiceLine line = lines.get(i);
                ps.setLong(1, line.invoiceId());
                if (line.partId() != null) {
                    ps.setLong(2, line.partId());
                } else {
                    ps.setNull(2, Types.BIGINT);
                }
                ps.setString(3, line.description());
                ps.setInt(4, line.qty());
                ps.setBigDecimal(5, line.unitPrice());
                ps.setBigDecimal(6, line.lineTotal());
            }

            @Override
            public int getBatchSize() {
                return lines.size();
            }
        });
    }

    @Override
    public Optional<InvoiceLine> findById(Long lineId) {
        String sql = "SELECT * FROM invoice_line WHERE line_id = :lineId";
        return namedJdbc.query(sql, Map.of("lineId", lineId), InvoiceLine.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<InvoiceLine> findByInvoiceId(Long invoiceId) {
        String sql = "SELECT * FROM invoice_line WHERE invoice_id = :invoiceId ORDER BY line_id ASC";
        return namedJdbc.query(sql, Map.of("invoiceId", invoiceId), InvoiceLine.ROW_MAPPER);
    }

    @Override
    public List<InvoiceLine> findAll() {
        String sql = "SELECT * FROM invoice_line ORDER BY line_id ASC";
        return namedJdbc.query(sql, Map.of(), InvoiceLine.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM invoice_line", Long.class);
        return count != null ? count : 0L;
    }
}
