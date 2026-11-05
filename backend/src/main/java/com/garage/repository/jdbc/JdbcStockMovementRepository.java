package com.garage.repository.jdbc;

import com.garage.model.entity.StockMovement;
import com.garage.repository.StockMovementRepository;
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
public class JdbcStockMovementRepository implements StockMovementRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcStockMovementRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public StockMovement save(StockMovement sm) {
        String sql = """
            INSERT INTO stock_movement (
                part_id, movement_type, delta_on_hand, delta_reserved,
                part_request_id, po_line_id, reason, user_id, created_at
            ) VALUES (
                :partId, :movementType, :deltaOnHand, :deltaReserved,
                :partRequestId, :poLineId, :reason, :userId, :createdAt
            )
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("partId", sm.partId())
            .addValue("movementType", sm.movementType().name())
            .addValue("deltaOnHand", sm.deltaOnHand())
            .addValue("deltaReserved", sm.deltaReserved())
            .addValue("partRequestId", sm.partRequestId())
            .addValue("poLineId", sm.poLineId())
            .addValue("reason", sm.reason())
            .addValue("userId", sm.userId())
            .addValue("createdAt", Timestamp.from(sm.createdAt()));

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"movement_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return sm.withMovementId(generatedId);
    }

    @Override
    public Optional<StockMovement> findById(Long movementId) {
        String sql = "SELECT * FROM stock_movement WHERE movement_id = :movementId";
        return namedJdbc.query(sql, Map.of("movementId", movementId), StockMovement.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<StockMovement> findByPartId(Long partId) {
        String sql = "SELECT * FROM stock_movement WHERE part_id = :partId ORDER BY created_at ASC";
        return namedJdbc.query(sql, Map.of("partId", partId), StockMovement.ROW_MAPPER);
    }

    @Override
    public List<StockMovement> findAll() {
        String sql = "SELECT * FROM stock_movement ORDER BY movement_id ASC";
        return namedJdbc.query(sql, Map.of(), StockMovement.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM stock_movement", Long.class);
        return count != null ? count : 0L;
    }
}
