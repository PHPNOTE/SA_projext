package com.garage.repository.jdbc;

import com.garage.model.entity.PurchaseOrder;
import com.garage.repository.PurchaseOrderRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Repository
public class JdbcPurchaseOrderRepository implements PurchaseOrderRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcPurchaseOrderRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public PurchaseOrder save(PurchaseOrder po) {
        String sql = """
            INSERT INTO purchase_order (po_no, supplier_name, status, expected_date, created_by, created_at, ordered_at)
            VALUES (:poNo, :supplierName, :status, :expectedDate, :createdBy, :createdAt, :orderedAt)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("poNo", po.poNo())
            .addValue("supplierName", po.supplierName())
            .addValue("status", po.status().name())
            .addValue("expectedDate", po.expectedDate() != null ? Date.valueOf(po.expectedDate()) : null)
            .addValue("createdBy", po.createdBy())
            .addValue("createdAt", Timestamp.from(po.createdAt()))
            .addValue("orderedAt", po.orderedAt() != null ? Timestamp.from(po.orderedAt()) : null);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"po_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return po.withPoId(generatedId);
    }

    @Override
    public Optional<PurchaseOrder> findById(Long poId) {
        String sql = "SELECT * FROM purchase_order WHERE po_id = :poId";
        return namedJdbc.query(sql, Map.of("poId", poId), PurchaseOrder.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<PurchaseOrder> findByPoNo(String poNo) {
        String sql = "SELECT * FROM purchase_order WHERE po_no = :poNo";
        return namedJdbc.query(sql, Map.of("poNo", poNo), PurchaseOrder.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<PurchaseOrder> findByStatus(PurchaseOrder.PurchaseOrderStatus status) {
        String sql = "SELECT * FROM purchase_order WHERE status = :status ORDER BY created_at DESC";
        return namedJdbc.query(sql, Map.of("status", status.name()), PurchaseOrder.ROW_MAPPER);
    }

    @Override
    public void updateStatus(Long poId, PurchaseOrder.PurchaseOrderStatus status) {
        String sql = "UPDATE purchase_order SET status = :status WHERE po_id = :poId";
        namedJdbc.update(sql, Map.of("poId", poId, "status", status.name()));
    }

    @Override
    public List<PurchaseOrder> findAll() {
        String sql = "SELECT * FROM purchase_order ORDER BY po_id ASC";
        return namedJdbc.query(sql, Map.of(), PurchaseOrder.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM purchase_order", Long.class);
        return count != null ? count : 0L;
    }
}
