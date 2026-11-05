package com.garage;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public abstract class BaseControllerIntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    protected String getManagerToken() {
        return "Bearer mock-token-1-MANAGER";
    }

    protected String getFrontDeskToken() {
        return "Bearer mock-token-2-FRONT_DESK";
    }

    protected String getMechanicToken() {
        return "Bearer mock-token-3-MECHANIC";
    }

    protected String getWarehouseToken() {
        return "Bearer mock-token-5-WAREHOUSE";
    }

    protected String getSalesToken() {
        return "Bearer mock-token-6-SALES";
    }
}
