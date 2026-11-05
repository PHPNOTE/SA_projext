package com.garage.repository.jdbc;

import com.garage.model.entity.Payment;
import com.garage.repository.PaymentRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Repository
public class JdbcPaymentRepository implements PaymentRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcPaymentRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Payment save(Payment payment) {
        String sql = """
            INSERT INTO payment (invoice_id, payer_type, amount, method, received_by, paid_at)
            VALUES (:invoiceId, :payerType, :amount, :method, :receivedBy, :paidAt)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("invoiceId", payment.invoiceId())
            .addValue("payerType", payment.payerType().name())
            .addValue("amount", payment.amount())
            .addValue("method", payment.method())
            .addValue("receivedBy", payment.receivedBy())
            .addValue("paidAt", Timestamp.from(payment.paidAt()));

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"payment_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return payment.withPaymentId(generatedId);
    }

    @Override
    public Optional<Payment> findById(Long paymentId) {
        String sql = "SELECT * FROM payment WHERE payment_id = :paymentId";
        return namedJdbc.query(sql, Map.of("paymentId", paymentId), Payment.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<Payment> findByInvoiceId(Long invoiceId) {
        String sql = "SELECT * FROM payment WHERE invoice_id = :invoiceId ORDER BY paid_at ASC";
        return namedJdbc.query(sql, Map.of("invoiceId", invoiceId), Payment.ROW_MAPPER);
    }

    @Override
    public BigDecimal getSumPaidByCustomer(Long invoiceId) {
        String sql = "SELECT COALESCE(SUM(amount), 0.00) FROM payment WHERE invoice_id = :invoiceId AND payer_type = 'CUSTOMER'";
        BigDecimal sum = namedJdbc.queryForObject(sql, Map.of("invoiceId", invoiceId), BigDecimal.class);
        return sum != null ? sum : BigDecimal.ZERO;
    }

    @Override
    public BigDecimal getTotalPaid(Long invoiceId) {
        String sql = "SELECT COALESCE(SUM(amount), 0.00) FROM payment WHERE invoice_id = :invoiceId";
        BigDecimal sum = namedJdbc.queryForObject(sql, Map.of("invoiceId", invoiceId), BigDecimal.class);
        return sum != null ? sum : BigDecimal.ZERO;
    }

    @Override
    public List<Payment> findAll() {
        String sql = "SELECT * FROM payment ORDER BY payment_id ASC";
        return namedJdbc.query(sql, Map.of(), Payment.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM payment", Long.class);
        return count != null ? count : 0L;
    }
}
