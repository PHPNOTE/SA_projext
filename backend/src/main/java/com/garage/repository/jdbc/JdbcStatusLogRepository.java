package com.garage.repository.jdbc;

import com.garage.model.entity.StatusLog;
import com.garage.repository.StatusLogRepository;
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
public class JdbcStatusLogRepository implements StatusLogRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcStatusLogRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public StatusLog save(StatusLog log) {
        String sql = """
            INSERT INTO status_log (entity_type, entity_id, from_status, to_status, user_id, note, created_at)
            VALUES (:entityType, :entityId, :fromStatus, :toStatus, :userId, :note, :createdAt)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("entityType", log.entityType().name())
            .addValue("entityId", log.entityId())
            .addValue("fromStatus", log.fromStatus())
            .addValue("toStatus", log.toStatus())
            .addValue("userId", log.userId())
            .addValue("note", log.note())
            .addValue("createdAt", Timestamp.from(log.createdAt()));

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"log_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return log.withLogId(generatedId);
    }

    @Override
    public Optional<StatusLog> findById(Long logId) {
        String sql = "SELECT * FROM status_log WHERE log_id = :logId";
        return namedJdbc.query(sql, Map.of("logId", logId), StatusLog.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<StatusLog> findByEntity(StatusLog.EntityType entityType, Long entityId) {
        String sql = "SELECT * FROM status_log WHERE entity_type = :entityType AND entity_id = :entityId ORDER BY created_at ASC";
        return namedJdbc.query(sql, Map.of("entityType", entityType.name(), "entityId", entityId), StatusLog.ROW_MAPPER);
    }

    @Override
    public List<StatusLog> findRecent(int limit) {
        String sql = "SELECT * FROM status_log ORDER BY created_at DESC LIMIT :limit";
        return namedJdbc.query(sql, Map.of("limit", limit), StatusLog.ROW_MAPPER);
    }

    @Override
    public List<StatusLog> findAll() {
        String sql = "SELECT * FROM status_log ORDER BY log_id ASC";
        return namedJdbc.query(sql, Map.of(), StatusLog.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM status_log", Long.class);
        return count != null ? count : 0L;
    }
}
