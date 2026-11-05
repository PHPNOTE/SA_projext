package com.garage.repository.jdbc;

import com.garage.model.entity.Vehicle;
import com.garage.repository.VehicleRepository;
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
public class JdbcVehicleRepository implements VehicleRepository {

    private final NamedParameterJdbcTemplate namedJdbc;
    private final JdbcTemplate jdbcTemplate;

    public JdbcVehicleRepository(NamedParameterJdbcTemplate namedJdbc, JdbcTemplate jdbcTemplate) {
        this.namedJdbc = namedJdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Vehicle save(Vehicle vehicle) {
        String sql = """
            INSERT INTO vehicle (customer_id, plate, make, model, `year`)
            VALUES (:customerId, :plate, :make, :model, :year)
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("customerId", vehicle.customerId())
            .addValue("plate", vehicle.plate())
            .addValue("make", vehicle.make())
            .addValue("model", vehicle.model())
            .addValue("year", vehicle.year());

        KeyHolder keyHolder = new GeneratedKeyHolder();
        namedJdbc.update(sql, params, keyHolder, new String[]{"vehicle_id"});
        Long generatedId = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return vehicle.withVehicleId(generatedId);
    }

    @Override
    public Optional<Vehicle> findById(Long vehicleId) {
        String sql = "SELECT * FROM vehicle WHERE vehicle_id = :vehicleId";
        return namedJdbc.query(sql, Map.of("vehicleId", vehicleId), Vehicle.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public Optional<Vehicle> findByPlate(String plate) {
        String sql = "SELECT * FROM vehicle WHERE plate = :plate";
        return namedJdbc.query(sql, Map.of("plate", plate), Vehicle.ROW_MAPPER)
            .stream().findFirst();
    }

    @Override
    public List<Vehicle> findByCustomerId(Long customerId) {
        String sql = "SELECT * FROM vehicle WHERE customer_id = :customerId ORDER BY vehicle_id ASC";
        return namedJdbc.query(sql, Map.of("customerId", customerId), Vehicle.ROW_MAPPER);
    }

    @Override
    public List<Vehicle> findAll() {
        String sql = "SELECT * FROM vehicle ORDER BY vehicle_id ASC";
        return namedJdbc.query(sql, Map.of(), Vehicle.ROW_MAPPER);
    }

    @Override
    public void update(Vehicle vehicle) {
        String sql = """
            UPDATE vehicle
            SET customer_id = :customerId, plate = :plate, make = :make, model = :model, `year` = :year
            WHERE vehicle_id = :vehicleId
            """;
        namedJdbc.update(sql, new MapSqlParameterSource()
            .addValue("vehicleId", vehicle.vehicleId())
            .addValue("customerId", vehicle.customerId())
            .addValue("plate", vehicle.plate())
            .addValue("make", vehicle.make())
            .addValue("model", vehicle.model())
            .addValue("year", vehicle.year()));
    }

    @Override
    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM vehicle", Long.class);
        return count != null ? count : 0L;
    }
}
