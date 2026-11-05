package com.garage.repository.jdbc;

import com.garage.model.entity.UserAccount;
import com.garage.repository.UserAccountRepository;
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
public class JdbcUserAccountRepository implements UserAccountRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcUserAccountRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public UserAccount save(UserAccount user) {
        String sql = """
            INSERT INTO user_account (username, password_hash, display_name, role, is_active)
            VALUES (:username, :passwordHash, :displayName, :role, :isActive)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("username", user.username())
            .addValue("passwordHash", user.passwordHash())
            .addValue("displayName", user.displayName())
            .addValue("role", user.role().name())
            .addValue("isActive", user.isActive());

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"user_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return user.withUserId(generatedId);
    }

    @Override
    public Optional<UserAccount> findById(Long userId) {
        String sql = "SELECT * FROM user_account WHERE user_id = :userId";
        return namedJdbc.query(sql, Map.of("userId", userId), UserAccount.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<UserAccount> findByUsername(String username) {
        String sql = "SELECT * FROM user_account WHERE username = :username";
        return namedJdbc.query(sql, Map.of("username", username), UserAccount.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<UserAccount> findAllActive() {
        String sql = "SELECT * FROM user_account WHERE is_active = TRUE ORDER BY user_id ASC";
        return namedJdbc.query(sql, Map.of(), UserAccount.ROW_MAPPER);
    }

    @Override
    public List<UserAccount> findAll() {
        String sql = "SELECT * FROM user_account ORDER BY user_id ASC";
        return namedJdbc.query(sql, Map.of(), UserAccount.ROW_MAPPER);
    }

    @Override
    public void update(UserAccount user) {
        String sql = """
            UPDATE user_account
            SET display_name = :displayName, role = :role, is_active = :isActive
            WHERE user_id = :userId
            """;
        namedJdbc.update(sql, new MapSqlParameterSource()
            .addValue("userId", user.userId())
            .addValue("displayName", user.displayName())
            .addValue("role", user.role().name())
            .addValue("isActive", user.isActive()));
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM user_account", Long.class);
        return count != null ? count : 0L;
    }
}
