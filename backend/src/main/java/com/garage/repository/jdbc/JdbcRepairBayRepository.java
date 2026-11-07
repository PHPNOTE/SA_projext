package com.garage.repository.jdbc;

import com.garage.model.entity.RepairBay;
import com.garage.repository.RepairBayRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Repository
public class JdbcRepairBayRepository implements RepairBayRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcRepairBayRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public RepairBay save(RepairBay bay) {
        String sql = """
            INSERT INTO repair_bay (name, is_active)
            VALUES (:name, :isActive)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("name", bay.name())
            .addValue("isActive", bay.isActive());

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"bay_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return bay.withBayId(generatedId);
    }

    @Override
    public Optional<RepairBay> findById(Long bayId) {
        String sql = "SELECT * FROM repair_bay WHERE bay_id = :bayId";
        return namedJdbc.query(sql, Map.of("bayId", bayId), RepairBay.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<RepairBay> findByName(String name) {
        String sql = "SELECT * FROM repair_bay WHERE name = :name";
        return namedJdbc.query(sql, Map.of("name", name), RepairBay.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<RepairBay> findAllActive() {
        String sql = "SELECT * FROM repair_bay WHERE is_active = TRUE ORDER BY name ASC";
        return namedJdbc.query(sql, Map.of(), RepairBay.ROW_MAPPER);
    }

    @Override
    public List<RepairBay> findAll() {
        String sql = "SELECT * FROM repair_bay ORDER BY bay_id ASC";
        return namedJdbc.query(sql, Map.of(), RepairBay.ROW_MAPPER);
    }

    @Override
    public void update(RepairBay bay) {
        String sql = """
            UPDATE repair_bay
            SET name = :name, is_active = :isActive
            WHERE bay_id = :bayId
            """;
        namedJdbc.update(sql, new MapSqlParameterSource()
            .addValue("bayId", bay.bayId())
            .addValue("name", bay.name())
            .addValue("isActive", bay.isActive()));
    }

    @Override
    public boolean isBayOccupied(Long bayId) {
        String sql = """
            SELECT COUNT(*) FROM repair_order
            WHERE bay_id = :bayId
              AND status IN ('IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'QC')
            """;
        Integer count = namedJdbc.queryForObject(sql, Map.of("bayId", bayId), Integer.class);
        return count != null && count > 0;
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM repair_bay", Long.class);
        return count != null ? count : 0L;
    }

    @Override
    public boolean deleteIfUnused(Long id) {
        String sql = "DELETE FROM repair_bay WHERE bay_id = :id AND NOT EXISTS (SELECT 1 FROM repair_order WHERE bay_id = :id)";
        try {
            return namedJdbc.update(sql, Map.of("id", id)) > 0;
        } catch (DataIntegrityViolationException e) {
            return false;
        }
    }
}
