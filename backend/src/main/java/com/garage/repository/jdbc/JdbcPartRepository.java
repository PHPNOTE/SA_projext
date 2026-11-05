package com.garage.repository.jdbc;

import com.garage.model.entity.Part;
import com.garage.repository.PartRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Repository
public class JdbcPartRepository implements PartRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcPartRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Part save(Part part) {
        String sql = """
            INSERT INTO part (sku, name, sell_price, on_hand, reserved, reorder_level, is_active)
            VALUES (:sku, :name, :sellPrice, :onHand, :reserved, :reorderLevel, :isActive)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("sku", part.sku())
            .addValue("name", part.name())
            .addValue("sellPrice", part.sellPrice())
            .addValue("onHand", part.onHand())
            .addValue("reserved", part.reserved())
            .addValue("reorderLevel", part.reorderLevel())
            .addValue("isActive", part.isActive());

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"part_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return part.withPartId(generatedId);
    }

    @Override
    public Optional<Part> findById(Long partId) {
        String sql = "SELECT * FROM part WHERE part_id = :partId";
        return namedJdbc.query(sql, Map.of("partId", partId), Part.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<Part> findByIdForUpdate(Long partId) {
        String sql = "SELECT * FROM part WHERE part_id = :partId FOR UPDATE";
        return namedJdbc.query(sql, Map.of("partId", partId), Part.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<Part> findBySku(String sku) {
        String sql = "SELECT * FROM part WHERE sku = :sku";
        return namedJdbc.query(sql, Map.of("sku", sku), Part.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<Part> findLowStock() {
        String sql = "SELECT * FROM part WHERE is_active = TRUE AND on_hand <= reorder_level ORDER BY on_hand ASC";
        return namedJdbc.query(sql, Map.of(), Part.ROW_MAPPER);
    }

    @Override
    public List<Part> findAllActive() {
        String sql = "SELECT * FROM part WHERE is_active = TRUE ORDER BY name ASC";
        return namedJdbc.query(sql, Map.of(), Part.ROW_MAPPER);
    }

    @Override
    public List<Part> findAll() {
        String sql = "SELECT * FROM part ORDER BY part_id ASC";
        return namedJdbc.query(sql, Map.of(), Part.ROW_MAPPER);
    }

    @Override
    public void updateStockCounters(Long partId, int newOnHand, int newReserved) {
        String sql = "UPDATE part SET on_hand = :onHand, reserved = :reserved WHERE part_id = :partId";
        namedJdbc.update(sql, new MapSqlParameterSource()
            .addValue("partId", partId)
            .addValue("onHand", newOnHand)
            .addValue("reserved", newReserved));
    }

    @Override
    public void update(Part part) {
        String sql = """
            UPDATE part
            SET sku = :sku, name = :name, sell_price = :sellPrice,
                on_hand = :onHand, reserved = :reserved,
                reorder_level = :reorderLevel, is_active = :isActive
            WHERE part_id = :partId
            """;
        namedJdbc.update(sql, new MapSqlParameterSource()
            .addValue("partId", part.partId())
            .addValue("sku", part.sku())
            .addValue("name", part.name())
            .addValue("sellPrice", part.sellPrice())
            .addValue("onHand", part.onHand())
            .addValue("reserved", part.reserved())
            .addValue("reorderLevel", part.reorderLevel())
            .addValue("isActive", part.isActive()));
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM part", Long.class);
        return count != null ? count : 0L;
    }
}
