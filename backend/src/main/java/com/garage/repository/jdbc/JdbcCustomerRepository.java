package com.garage.repository.jdbc;

import com.garage.model.entity.Customer;
import com.garage.repository.CustomerRepository;
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
public class JdbcCustomerRepository implements CustomerRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcCustomerRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Customer save(Customer customer) {
        String sql = """
            INSERT INTO customer (name, phone, note)
            VALUES (:name, :phone, :note)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("name", customer.name())
            .addValue("phone", customer.phone())
            .addValue("note", customer.note());

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"customer_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return customer.withCustomerId(generatedId);
    }

    @Override
    public Optional<Customer> findById(Long customerId) {
        String sql = "SELECT * FROM customer WHERE customer_id = :customerId";
        return namedJdbc.query(sql, Map.of("customerId", customerId), Customer.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<Customer> findByPhone(String phone) {
        String sql = "SELECT * FROM customer WHERE phone = :phone";
        return namedJdbc.query(sql, Map.of("phone", phone), Customer.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<Customer> searchByNameOrPhone(String query) {
        String sql = "SELECT * FROM customer WHERE name LIKE :query OR phone LIKE :query ORDER BY name ASC";
        return namedJdbc.query(sql, Map.of("query", "%" + query + "%"), Customer.ROW_MAPPER);
    }

    @Override
    public List<Customer> findAll() {
        String sql = "SELECT * FROM customer ORDER BY customer_id ASC";
        return namedJdbc.query(sql, Map.of(), Customer.ROW_MAPPER);
    }

    @Override
    public void update(Customer customer) {
        String sql = """
            UPDATE customer
            SET name = :name, phone = :phone, note = :note
            WHERE customer_id = :customerId
            """;
        namedJdbc.update(sql, new MapSqlParameterSource()
            .addValue("customerId", customer.customerId())
            .addValue("name", customer.name())
            .addValue("phone", customer.phone())
            .addValue("note", customer.note()));
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM customer", Long.class);
        return count != null ? count : 0L;
    }
}
