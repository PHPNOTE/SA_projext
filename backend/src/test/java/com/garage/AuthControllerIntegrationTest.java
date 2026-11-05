package com.garage;

import com.garage.dto.AuthDtos.LoginRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("AuthController REST Endpoint Integration Tests")
public class AuthControllerIntegrationTest extends BaseControllerIntegrationTest {

    @Test
    @DisplayName("Login with valid credentials returns HTTP 200, token, and user DTO")
    void testLoginSuccess() throws Exception {
        LoginRequest req = new LoginRequest("admin", "password123");

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").exists())
            .andExpect(jsonPath("$.user.username").value("admin"))
            .andExpect(jsonPath("$.user.role").value("MANAGER"));
    }

    @Test
    @DisplayName("Login with incorrect password returns HTTP 401")
    void testLoginInvalidPassword() throws Exception {
        LoginRequest req = new LoginRequest("admin", "wrong_password");

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").exists());
    }

    @Test
    @DisplayName("Login with nonexistent username returns HTTP 401")
    void testLoginNonexistentUser() throws Exception {
        LoginRequest req = new LoginRequest("nonexistent_user", "password123");

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Login with empty credentials returns HTTP 400")
    void testLoginEmptyCredentials() throws Exception {
        LoginRequest req = new LoginRequest("", "");

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("GET /api/auth/me with valid Bearer token returns current user profile")
    void testGetMeAuthenticated() throws Exception {
        mockMvc.perform(get("/api/auth/me")
                .header("Authorization", getManagerToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.username").value("admin"))
            .andExpect(jsonPath("$.role").value("MANAGER"));
    }

    @Test
    @DisplayName("GET /api/auth/me without token returns HTTP 401 Unauthorized")
    void testGetMeUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }
}
