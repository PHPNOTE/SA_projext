package com.garage.repository.jdbc;

import com.garage.model.entity.Invoice;
import com.garage.repository.InvoiceRepository;
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
public class JdbcInvoiceRepository implements InvoiceRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcInvoiceRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Invoice save(Invoice inv) {
        String sql = """
            INSERT INTO invoice (
                invoice_no, repair_id, sale_id, subtotal, insurance_covered, customer_due, status, issued_by, issued_at
            ) VALUES (
                :invoiceNo, :repairId, :saleId, :subtotal, :insuranceCovered, :customerDue, :status, :issuedBy, :issuedAt
            )
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("invoiceNo", inv.invoiceNo())
            .addValue("repairId", inv.repairId())
            .addValue("saleId", inv.saleId())
            .addValue("subtotal", inv.subtotal())
            .addValue("insuranceCovered", inv.insuranceCovered())
            .addValue("customerDue", inv.customerDue())
            .addValue("status", inv.status().name())
            .addValue("issuedBy", inv.issuedBy())
            .addValue("issuedAt", Timestamp.from(inv.issuedAt()));

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"invoice_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return inv.withInvoiceId(generatedId);
    }

    @Override
    public Optional<Invoice> findById(Long invoiceId) {
        String sql = "SELECT * FROM invoice WHERE invoice_id = :invoiceId";
        return namedJdbc.query(sql, Map.of("invoiceId", invoiceId), Invoice.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<Invoice> findByInvoiceNo(String invoiceNo) {
        String sql = "SELECT * FROM invoice WHERE invoice_no = :invoiceNo";
        return namedJdbc.query(sql, Map.of("invoiceNo", invoiceNo), Invoice.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<Invoice> findByRepairId(Long repairId) {
        String sql = "SELECT * FROM invoice WHERE repair_id = :repairId ORDER BY issued_at DESC LIMIT 1";
        return namedJdbc.query(sql, Map.of("repairId", repairId), Invoice.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<Invoice> findBySaleId(Long saleId) {
        String sql = "SELECT * FROM invoice WHERE sale_id = :saleId ORDER BY issued_at DESC LIMIT 1";
        return namedJdbc.query(sql, Map.of("saleId", saleId), Invoice.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public void updateStatus(Long invoiceId, Invoice.InvoiceStatus status) {
        String sql = "UPDATE invoice SET status = :status WHERE invoice_id = :invoiceId";
        namedJdbc.update(sql, Map.of("invoiceId", invoiceId, "status", status.name()));
    }

    @Override
    public List<Invoice> findAll() {
        String sql = "SELECT * FROM invoice ORDER BY invoice_id ASC";
        return namedJdbc.query(sql, Map.of(), Invoice.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM invoice", Long.class);
        return count != null ? count : 0L;
    }
}
