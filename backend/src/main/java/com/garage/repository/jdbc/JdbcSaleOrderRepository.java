package com.garage.repository.jdbc;

import com.garage.model.entity.SaleOrder;
import com.garage.repository.SaleOrderRepository;
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
public class JdbcSaleOrderRepository implements SaleOrderRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcSaleOrderRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public SaleOrder save(SaleOrder sale) {
        String sql = """
            INSERT INTO sale_order (sale_no, customer_id, status, created_by, created_at)
            VALUES (:saleNo, :customerId, :status, :createdBy, :createdAt)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("saleNo", sale.saleNo())
            .addValue("customerId", sale.customerId())
            .addValue("status", sale.status().name())
            .addValue("createdBy", sale.createdBy())
            .addValue("createdAt", Timestamp.from(sale.createdAt()));

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"sale_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return sale.withSaleId(generatedId);
    }

    @Override
    public Optional<SaleOrder> findById(Long saleId) {
        String sql = "SELECT * FROM sale_order WHERE sale_id = :saleId";
        return namedJdbc.query(sql, Map.of("saleId", saleId), SaleOrder.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<SaleOrder> findBySaleNo(String saleNo) {
        String sql = "SELECT * FROM sale_order WHERE sale_no = :saleNo";
        return namedJdbc.query(sql, Map.of("saleNo", saleNo), SaleOrder.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<SaleOrder> findByStatus(SaleOrder.SaleOrderStatus status) {
        String sql = "SELECT * FROM sale_order WHERE status = :status ORDER BY created_at DESC";
        return namedJdbc.query(sql, Map.of("status", status.name()), SaleOrder.ROW_MAPPER);
    }

    @Override
    public void updateStatus(Long saleId, SaleOrder.SaleOrderStatus status) {
        String sql = "UPDATE sale_order SET status = :status WHERE sale_id = :saleId";
        namedJdbc.update(sql, Map.of("saleId", saleId, "status", status.name()));
    }

    @Override
    public List<SaleOrder> findAll() {
        String sql = "SELECT * FROM sale_order ORDER BY sale_id ASC";
        return namedJdbc.query(sql, Map.of(), SaleOrder.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sale_order", Long.class);
        return count != null ? count : 0L;
    }
}
