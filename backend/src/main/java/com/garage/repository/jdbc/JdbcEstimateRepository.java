package com.garage.repository.jdbc;

import com.garage.model.entity.Estimate;
import com.garage.repository.EstimateRepository;
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
public class JdbcEstimateRepository implements EstimateRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcEstimateRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Estimate save(Estimate est) {
        String sql = """
            INSERT INTO estimate (repair_id, revision_no, status, diagnosis_note, created_by, decided_at)
            VALUES (:repairId, :revisionNo, :status, :diagnosisNote, :createdBy, :decidedAt)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("repairId", est.repairId())
            .addValue("revisionNo", est.revisionNo())
            .addValue("status", est.status().name())
            .addValue("diagnosisNote", est.diagnosisNote())
            .addValue("createdBy", est.createdBy())
            .addValue("decidedAt", est.decidedAt() != null ? Timestamp.from(est.decidedAt()) : null);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"estimate_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return est.withEstimateId(generatedId);
    }

    @Override
    public Optional<Estimate> findById(Long estimateId) {
        String sql = "SELECT * FROM estimate WHERE estimate_id = :estimateId";
        return namedJdbc.query(sql, Map.of("estimateId", estimateId), Estimate.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<Estimate> findByRepairId(Long repairId) {
        String sql = "SELECT * FROM estimate WHERE repair_id = :repairId ORDER BY revision_no ASC";
        return namedJdbc.query(sql, Map.of("repairId", repairId), Estimate.ROW_MAPPER);
    }

    @Override
    public Optional<Estimate> findByRepairIdAndRevisionNo(Long repairId, int revisionNo) {
        String sql = "SELECT * FROM estimate WHERE repair_id = :repairId AND revision_no = :revisionNo";
        return namedJdbc.query(sql, Map.of("repairId", repairId, "revisionNo", revisionNo), Estimate.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<Estimate> findLatestRevision(Long repairId) {
        String sql = "SELECT * FROM estimate WHERE repair_id = :repairId ORDER BY revision_no DESC LIMIT 1";
        return namedJdbc.query(sql, Map.of("repairId", repairId), Estimate.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public void updateStatus(Long estimateId, Estimate.EstimateStatus status) {
        String sql = "UPDATE estimate SET status = :status, decided_at = NOW() WHERE estimate_id = :estimateId";
        namedJdbc.update(sql, Map.of("estimateId", estimateId, "status", status.name()));
    }

    @Override
    public List<Estimate> findAll() {
        String sql = "SELECT * FROM estimate ORDER BY estimate_id ASC";
        return namedJdbc.query(sql, Map.of(), Estimate.ROW_MAPPER);
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM estimate", Long.class);
        return count != null ? count : 0L;
    }
}
